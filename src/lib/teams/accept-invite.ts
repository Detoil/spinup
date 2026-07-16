import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Securely accept a team invite.
 *
 * The invite id is the ONLY thing taken from the client. Everything that
 * grants access — which team, which role — is read from the invite row and
 * verified against the authenticated user's email. This prevents a user from
 * joining an arbitrary team (or escalating their role) by forging the
 * team_id / role fields that used to come straight from the form.
 */
export async function acceptTeamInvite(
  inviteId: string,
  user: { id: string; email?: string | null }
): Promise<{ teamId: string } | { error: string }> {
  if (!inviteId) return { error: "Missing invite" };

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("team_invites")
    .select("id, team_id, email, role, accepted")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) return { error: "Invite not found" };
  if (invite.accepted) return { error: "Invite already accepted" };
  if (!user.email || invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return { error: "This invite is not for your account" };
  }

  // Role comes from the invite row, never from client input.
  const { error: memberError } = await admin.from("team_members").upsert(
    { team_id: invite.team_id, user_id: user.id, role: invite.role },
    { onConflict: "team_id,user_id", ignoreDuplicates: true }
  );
  if (memberError) return { error: memberError.message };

  await admin.from("team_invites").update({ accepted: true }).eq("id", invite.id);

  return { teamId: invite.team_id };
}
