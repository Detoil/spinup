import { NextRequest, NextResponse } from "next/server";
import { getTeamAuth } from "@/lib/teams/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDetoilBundle } from "@/lib/export/detoil";
import type { ValueProposition } from "@/lib/types/database";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  if (!teamId || !UUID_RE.test(teamId)) {
    return NextResponse.json({ error: "valid teamId required" }, { status: 400 });
  }

  const auth = await getTeamAuth(teamId);
  if (!auth) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!auth.isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const [teamResult, artifactsResult, journalResult, fundingResult, advisorsResult] =
    await Promise.all([
      admin
        .from("teams")
        .select("name, operating_name, current_phase, value_proposition")
        .eq("id", teamId)
        .single(),
      admin
        .from("artifacts")
        .select("artifact_type, title, data, updated_at")
        .eq("team_id", teamId)
        .order("updated_at", { ascending: false }),
      admin
        .from("journal_entries")
        .select("week_start, what_we_did, what_we_learned, what_changed, blockers, next_week_priority")
        .eq("team_id", teamId)
        .order("week_start", { ascending: false }),
      admin
        .from("funding_tracker_entries")
        .select("funder, amount_available, stage_fit, status, deadline, notes, url")
        .eq("team_id", teamId),
      admin
        .from("advisor_entries")
        .select("name, expertise, relationship_stage, how_we_know_them, next_action")
        .eq("team_id", teamId),
    ]);

  if (!teamResult.data) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const team = teamResult.data;
  const buffer = await buildDetoilBundle({
    team: {
      name: team.name,
      operating_name: team.operating_name,
      current_phase: team.current_phase,
      value_proposition: (team.value_proposition as ValueProposition | null) ?? null,
    },
    artifacts: (artifactsResult.data ?? []).map((a) => ({
      artifact_type: a.artifact_type,
      title: a.title,
      data: (a.data as Record<string, unknown>) ?? {},
      updated_at: a.updated_at,
    })),
    journal: journalResult.data ?? [],
    funding: fundingResult.data ?? [],
    advisors: advisorsResult.data ?? [],
  });

  const companyName = team.operating_name || team.name || "company";
  const filename = `${companyName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-detoil-handover.zip`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
