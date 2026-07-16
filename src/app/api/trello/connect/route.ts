import { NextRequest, NextResponse } from "next/server";
import { getTeamAuth } from "@/lib/teams/authz";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Step 1: Redirect user to Trello for OAuth 1.0a authorisation
// Trello uses a simplified OAuth 1.0a — request token not needed; go directly to authorize URL
export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("teamId");
  if (!teamId || !UUID_RE.test(teamId)) {
    return NextResponse.json({ error: "valid teamId required" }, { status: 400 });
  }

  // Only a team entrepreneur (or admin) may connect Trello for the team.
  const auth = await getTeamAuth(teamId);
  if (!auth) return NextResponse.redirect(new URL("/sign-in", request.url));
  if (!auth.isEntrepreneur) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.TRELLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Trello API key not configured" }, { status: 500 });
  }

  // CSRF protection: generate a state nonce, stash it in an httpOnly cookie, and
  // require it to come back on the callback before we bind any Trello token.
  const state = crypto.randomUUID();
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/api/trello/callback?teamId=${teamId}&state=${state}`;

  const trelloAuthorizeUrl = new URL("https://trello.com/1/OAuthAuthorizeToken");
  trelloAuthorizeUrl.searchParams.set("key", apiKey);
  trelloAuthorizeUrl.searchParams.set("name", "SpinUp");
  trelloAuthorizeUrl.searchParams.set("expiration", "never");
  trelloAuthorizeUrl.searchParams.set("response_type", "token");
  trelloAuthorizeUrl.searchParams.set("scope", "read,write");
  trelloAuthorizeUrl.searchParams.set("callback_method", "fragment");
  trelloAuthorizeUrl.searchParams.set("return_url", callbackUrl);

  const res = NextResponse.redirect(trelloAuthorizeUrl.toString());
  res.cookies.set("trello_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/trello",
    maxAge: 600,
  });
  return res;
}
