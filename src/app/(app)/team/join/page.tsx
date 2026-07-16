import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { acceptTeamInvite } from "@/lib/teams/accept-invite";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function JoinTeamPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const admin = createAdminClient();

  // Fetch pending invites for the current user's email
  const { data: invites } = await admin
    .from("team_invites")
    .select("id, team_id, role, teams(name)")
    .eq("email", user.email!)
    .eq("accepted", false);

  async function acceptInvite(formData: FormData) {
    "use server";

    const inviteId = formData.get("invite_id") as string;
    if (!inviteId) return;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/sign-in");

    const result = await acceptTeamInvite(inviteId, { id: user.id, email: user.email });
    if ("error" in result) redirect("/team/join");

    redirect(`/teams/${result.teamId}/tools/company-name`);
  }

  const hasInvites = invites && invites.length > 0;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">SpinUp</h1>
        <p className="text-sm text-muted-foreground">
          Join an existing team
        </p>
      </div>
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Team invites</CardTitle>
            <CardDescription>
              {hasInvites
                ? "You have pending invites. Accept one to join a team."
                : "No pending invites found for your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasInvites ? (
              <div className="flex flex-col gap-3">
                {invites.map((invite) => {
                  const teamName =
                    invite.teams &&
                    typeof invite.teams === "object" &&
                    "name" in invite.teams
                      ? (invite.teams as { name: string }).name
                      : "Unknown team";

                  return (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="font-medium">{teamName}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          Role: {invite.role}
                        </p>
                      </div>
                      <form action={acceptInvite}>
                        <input type="hidden" name="invite_id" value={invite.id} />
                        <input type="hidden" name="team_id" value={invite.team_id} />
                        <input type="hidden" name="role" value={invite.role} />
                        <Button type="submit" size="sm">
                          Accept
                        </Button>
                      </form>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <p className="text-sm text-muted-foreground">
                  No pending invites found for <strong>{user.email}</strong>
                </p>
                <Button asChild variant="outline">
                  <Link href="/team/create">Create a new team instead</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
