import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TeamMemberRole } from "@/lib/types/database";

export interface TeamAuth {
  user: { id: string; email?: string | null };
  role: TeamMemberRole | null;
  isAdmin: boolean;
  isEntrepreneur: boolean;
  isMember: boolean;
}

/**
 * Resolve the current user's authorization for a team. Returns null when there
 * is no authenticated user. Use in server actions / route handlers that mutate
 * team-scoped data — several of them run through the RLS-bypassing admin
 * client, so this membership check is the real access-control gate.
 */
export async function getTeamAuth(teamId: string): Promise<TeamAuth | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: member }, { data: profile }] = await Promise.all([
    admin
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("platform_role")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const isAdmin = profile?.platform_role === "admin";
  const role = member?.role ?? null;
  return {
    user: { id: user.id, email: user.email },
    role,
    isAdmin,
    isEntrepreneur: role === "entrepreneur" || isAdmin,
    isMember: role !== null || isAdmin,
  };
}
