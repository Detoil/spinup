import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { PlatformRole, TeamMemberRole, ValueProposition } from "@/lib/types/database";

export interface ToolContext {
  user: { id: string; email: string };
  team: {
    id: string;
    name: string;
    operating_name: string | null;
    current_phase: string;
    value_proposition: ValueProposition | null;
    vp_updated_at: string | null;
  };
  platformRole: PlatformRole;
  // effectiveRole is "mentor" when the user is a team mentor, "admin" for platform admins,
  // or "entrepreneur" otherwise — used for the guidance notes panel
  effectiveRole: "admin" | "mentor" | "entrepreneur";
  teamRole: TeamMemberRole | null;
  adminNotes: ToolNote[];
  mentorNotes: ToolNote[];
}

export interface ToolNote {
  id: string;
  note_text: string;
  url: string | null;
  url_label: string | null;
  author_role: "admin" | "mentor";
  created_by: string;
  created_at: string;
}

export async function fetchToolContext(
  teamId: string,
  artifactType: string
): Promise<ToolContext> {
  const supabase = await createClient();
  const admin = createAdminClient();

  // teamId is interpolated into a PostgREST .or() filter below — reject anything
  // that isn't a plain UUID to avoid filter injection.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)) {
    redirect("/dashboard");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const [teamResult, memberResult, profileResult, notesResult] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, name, operating_name, current_phase, value_proposition, vp_updated_at")
        .eq("id", teamId)
        .single(),
      supabase
        .from("team_members")
        .select("role")
        .eq("team_id", teamId)
        .eq("user_id", user.id)
        .maybeSingle(),
      // Use admin client to reliably read platform_role (bypasses JWT forwarding issues)
      admin
        .from("profiles")
        .select("platform_role")
        .eq("id", user.id)
        .single(),
      supabase
        .from("tool_notes")
        .select("id, note_text, url, url_label, author_role, created_by, created_at")
        .eq("artifact_type", artifactType)
        .or(`team_id.is.null,team_id.eq.${teamId}`)
        .order("created_at", { ascending: true }),
    ]);

  if (!teamResult.data) redirect("/dashboard");

  const platformRole: PlatformRole =
    profileResult.data?.platform_role ?? "entrepreneur";
  const teamRole: TeamMemberRole | null =
    memberResult.data?.role ?? null;

  if (!teamRole && platformRole !== "admin") redirect("/dashboard");

  // effectiveRole elevates team mentors so they can add guidance notes
  const effectiveRole: "admin" | "mentor" | "entrepreneur" =
    platformRole === "admin"
      ? "admin"
      : teamRole === "mentor"
        ? "mentor"
        : "entrepreneur";

  const allNotes = (notesResult.data ?? []) as ToolNote[];
  const adminNotes = allNotes.filter((n) => n.author_role === "admin");
  const mentorNotes = allNotes.filter((n) => n.author_role === "mentor");

  return {
    user: { id: user.id, email: user.email ?? "" },
    team: teamResult.data as ToolContext["team"],
    platformRole,
    effectiveRole,
    teamRole,
    adminNotes,
    mentorNotes,
  };
}
