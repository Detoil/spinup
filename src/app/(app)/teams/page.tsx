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
import { Separator } from "@/components/ui/separator";
import { Building2, Plus, Mail, ArrowRight, ArrowLeft } from "lucide-react";

export default async function TeamsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const admin = createAdminClient();

  const [membershipsResult, invitesResult] = await Promise.all([
    admin
      .from("team_members")
      .select("team_id, role, joined_at, teams(id, name, operating_name, current_phase)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true }),
    admin
      .from("team_invites")
      .select("id, team_id, role, teams(name)")
      .eq("email", user.email!)
      .eq("accepted", false),
  ]);

  const memberships = membershipsResult.data ?? [];
  const invites = invitesResult.data ?? [];

  const hasTeams = memberships.length > 0;
  const hasInvites = invites.length > 0;

  // Fast path: single team, no pending invites
  if (memberships.length === 1 && !hasInvites) {
    redirect(`/teams/${memberships[0].team_id}`);
  }

  // No teams and no invites → create first team
  if (!hasTeams && !hasInvites) {
    redirect("/team/create");
  }

  async function acceptInvite(formData: FormData) {
    "use server";

    const inviteId = formData.get("invite_id") as string;
    if (!inviteId) return;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/sign-in");

    const result = await acceptTeamInvite(inviteId, { id: user.id, email: user.email });
    if ("error" in result) redirect("/teams");

    redirect(`/teams/${result.teamId}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">SpinUp Tools</h1>
        <p className="text-sm text-muted-foreground">Select a team to continue</p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-4">
        {hasTeams && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="size-4" />
                Your teams
              </CardTitle>
              <CardDescription>
                Select a team to continue working
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {memberships.map((m) => {
                const team =
                  m.teams && typeof m.teams === "object" && "name" in m.teams
                    ? (m.teams as { id: string; name: string; operating_name: string | null })
                    : null;
                const displayName = team?.operating_name || team?.name || "Unknown team";
                return (
                  <Link
                    key={m.team_id}
                    href={`/teams/${m.team_id}`}
                    className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-accent group"
                  >
                    <div>
                      <p className="font-medium">{displayName}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {m.role}
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        )}

        {hasInvites && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="size-4" />
                Pending invites
              </CardTitle>
              <CardDescription>
                You&apos;ve been invited to join these teams
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
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
                      <p className="text-xs text-muted-foreground capitalize">
                        Invited as {invite.role}
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
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/team/create">
            <Plus className="size-4" />
            Create a new team
          </Link>
        </Button>

        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/dashboard">
            <ArrowLeft className="size-3.5" />
            Back to apps
          </Link>
        </Button>
      </div>
    </div>
  );
}
