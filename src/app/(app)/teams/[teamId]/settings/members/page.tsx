import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import { getTeamAuth } from "@/lib/teams/authz";
import { escapeHtml } from "@/lib/html";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

async function inviteMember(teamId: string, _userId: string, teamName: string, formData: FormData) {
  "use server";
  const auth = await getTeamAuth(teamId);
  if (!auth) redirect("/sign-in");
  if (!auth.isEntrepreneur) return;

  const email = (formData.get("email") as string).trim().toLowerCase();
  const role = (formData.get("role") as string) === "mentor" ? "mentor" : "entrepreneur";
  if (!email) return;

  const admin = createAdminClient();
  await admin
    .from("team_invites")
    .upsert(
      { team_id: teamId, email, role, invited_by: auth.user.id },
      { onConflict: "team_id,email" }
    );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.spinupapp.co.za";
  const roleLabel = role === "mentor" ? "mentor" : "co-founder";

  await sendEmail({
    to: email,
    subject: `You've been invited to join ${teamName} on SpinUp`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="font-size:20px;margin-bottom:8px;">You're invited to SpinUp</h2>
        <p style="color:#555;margin-bottom:24px;">
          You've been invited to join <strong>${escapeHtml(teamName)}</strong> as a <strong>${roleLabel}</strong>.
        </p>
        <a href="${appUrl}/team/join"
           style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          Accept invite
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px;">
          Sign in (or create an account) with this email address to accept: <strong>${escapeHtml(email)}</strong>
        </p>
      </div>
    `,
  });

  revalidatePath(`/teams/${teamId}/settings/members`);
}

async function cancelInvite(teamId: string, inviteId: string) {
  "use server";
  const auth = await getTeamAuth(teamId);
  if (!auth) redirect("/sign-in");
  if (!auth.isEntrepreneur) return;

  const admin = createAdminClient();
  await admin.from("team_invites").delete().eq("id", inviteId).eq("team_id", teamId);
  revalidatePath(`/teams/${teamId}/settings/members`);
}

async function removeMember(teamId: string, memberId: string) {
  "use server";
  const auth = await getTeamAuth(teamId);
  if (!auth) redirect("/sign-in");
  if (!auth.isEntrepreneur) return;

  const admin = createAdminClient();
  await admin.from("team_members").delete().eq("id", memberId).eq("team_id", teamId);
  revalidatePath(`/teams/${teamId}/settings/members`);
}

export default async function MembersPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const admin = createAdminClient();
  const [membersResult, invitesResult, teamResult] = await Promise.all([
    admin.from("team_members").select("id, role, joined_at, profiles(id, full_name, email)").eq("team_id", teamId),
    admin.from("team_invites").select("id, email, role, accepted, created_at").eq("team_id", teamId).eq("accepted", false),
    admin.from("teams").select("name").eq("id", teamId).single(),
  ]);

  const members = membersResult.data ?? [];
  const pendingInvites = invitesResult.data ?? [];
  const teamName = teamResult.data?.name ?? "your team";

  const inviteAction = inviteMember.bind(null, teamId, user.id, teamName);

  const entrepreneurs = members.filter((m) => m.role === "entrepreneur");
  const mentors = members.filter((m) => m.role === "mentor");

  return (
    <div className="space-y-6 max-w-xl">
      {/* Co-founders */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Co-founders</h2>
        {entrepreneurs.length === 0 && (
          <p className="text-sm text-muted-foreground">No co-founders yet.</p>
        )}
        {entrepreneurs.map((m) => {
          const profile = m.profiles as { id: string; full_name: string | null; email: string } | null;
          const removeAction = removeMember.bind(null, teamId, m.id);
          return (
            <div key={m.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-medium">{profile?.full_name ?? profile?.email ?? "Unknown"}</p>
                {profile?.full_name && <p className="text-xs text-muted-foreground">{profile.email}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">Entrepreneur</Badge>
                {profile?.id !== user.id && (
                  <form action={removeAction}>
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">Remove</Button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mentors */}
      {mentors.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Mentors</h2>
            {mentors.map((m) => {
              const profile = m.profiles as { id: string; full_name: string | null; email: string } | null;
              const removeAction = removeMember.bind(null, teamId, m.id);
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{profile?.full_name ?? profile?.email ?? "Unknown"}</p>
                    {profile?.full_name && <p className="text-xs text-muted-foreground">{profile.email}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Mentor</Badge>
                    <form action={removeAction}>
                      <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">Remove</Button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Pending invites</h2>
            {pendingInvites.map((inv) => {
              const cancelAction = cancelInvite.bind(null, teamId, inv.id);
              return (
                <div key={inv.id} className="flex items-center justify-between text-sm py-1">
                  <div>
                    <span className="text-muted-foreground">{inv.email}</span>
                    <span className="ml-2 text-xs text-muted-foreground capitalize">({inv.role})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Pending</Badge>
                    <form action={cancelAction}>
                      <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 px-2 text-xs">Cancel</Button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Separator />

      {/* Invite form */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Invite someone</h2>
        <form action={inviteAction} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="email" className="sr-only">Email address</Label>
              <Input id="email" name="email" type="email" placeholder="email@example.com" required />
            </div>
            <select
              name="role"
              defaultValue="entrepreneur"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="entrepreneur">Co-founder</option>
              <option value="mentor">Mentor</option>
            </select>
            <Button type="submit">Send invite</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            They&apos;ll receive an email with a link to accept the invite.
            Mentors can view all content but cannot edit.
          </p>
        </form>
      </div>
    </div>
  );
}
