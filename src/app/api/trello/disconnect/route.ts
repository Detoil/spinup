import { NextRequest, NextResponse } from "next/server";
import { getTeamAuth } from "@/lib/teams/authz";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST (not GET): disconnecting is a state change, so it must not be triggerable
// via a cross-site <img>/link. Only a team entrepreneur (or admin) may do it.
export async function POST(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("teamId");
  if (!teamId || !UUID_RE.test(teamId)) {
    return NextResponse.json({ error: "valid teamId required" }, { status: 400 });
  }

  const auth = await getTeamAuth(teamId);
  if (!auth) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!auth.isEntrepreneur) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  await admin.from("trello_connections").delete().eq("team_id", teamId);

  return NextResponse.json({ ok: true });
}
