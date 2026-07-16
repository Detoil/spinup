import { NextRequest, NextResponse } from "next/server";
import { getTeamAuth } from "@/lib/teams/authz";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Trello's "fragment" callback passes the token in the URL hash — we need a page to extract it
// This route renders a small page that reads the fragment and posts it back to our server
export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("teamId");
  const token = request.nextUrl.searchParams.get("token"); // Posted from the client-side page below
  const state = request.nextUrl.searchParams.get("state");

  // teamId is reflected into an HTML/JS response below — reject anything that
  // isn't a plain UUID so it can never break out of the string context (XSS).
  if (!teamId || !UUID_RE.test(teamId)) {
    return NextResponse.json({ error: "valid teamId required" }, { status: 400 });
  }

  // CSRF: the state returned by Trello must match the nonce we set at connect time.
  const expectedState = request.cookies.get("trello_oauth_state")?.value;
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL(`/teams/${teamId}/settings/trello?error=invalid_state`, request.url)
    );
  }

  // If token is present (second leg), save it
  if (token && teamId) {
    // Only a team entrepreneur (or admin) may bind a Trello token to the team.
    const auth = await getTeamAuth(teamId);
    if (!auth) return NextResponse.redirect(new URL("/sign-in", request.url));
    if (!auth.isEntrepreneur) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKey = process.env.TRELLO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Trello API key not configured" }, { status: 500 });
    }

    // Get member info from Trello to verify token
    const meRes = await fetch(`https://api.trello.com/1/members/me?key=${apiKey}&token=${encodeURIComponent(token)}`);
    if (!meRes.ok) {
      return NextResponse.redirect(new URL(`/teams/${teamId}/settings/trello?error=invalid_token`, request.url));
    }
    const me = await meRes.json() as { id: string };

    // Upsert trello_connections — note: we store token as access_token, no secret for Trello's simplified auth
    const admin = createAdminClient();
    await admin.from("trello_connections").upsert({
      team_id: teamId,
      access_token: token,
      access_token_secret: "", // Trello simplified OAuth doesn't use token secrets
      trello_member_id: me.id,
      connected_at: new Date().toISOString(),
    }, { onConflict: "team_id" });

    const done = NextResponse.redirect(new URL(`/teams/${teamId}/settings/trello?connected=1`, request.url));
    done.cookies.delete("trello_oauth_state");
    return done;
  }

  // First leg: render a page that extracts the token from the URL fragment.
  // teamId/state are JSON-encoded into the script — combined with the UUID
  // validation above, they cannot inject markup or script.
  const html = `<!DOCTYPE html>
<html>
<head><title>Connecting Trello...</title></head>
<body>
<p>Connecting your Trello account...</p>
<script>
  const teamId = ${JSON.stringify(teamId)};
  const state = ${JSON.stringify(state)};
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const token = params.get('token');
  if (token) {
    window.location.href = '/api/trello/callback?teamId=' + encodeURIComponent(teamId) + '&state=' + encodeURIComponent(state) + '&token=' + encodeURIComponent(token);
  } else {
    window.location.href = '/teams/' + encodeURIComponent(teamId) + '/settings/trello?error=no_token';
  }
</script>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
