import { NextRequest, NextResponse } from "next/server";
import { getTeamAuth } from "@/lib/teams/authz";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET: list boards for connected account
// POST: save selected board and register webhook
export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("teamId");
  if (!teamId || !UUID_RE.test(teamId)) return NextResponse.json({ error: "valid teamId required" }, { status: 400 });

  const auth = await getTeamAuth(teamId);
  if (!auth) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!auth.isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: conn } = await admin.from("trello_connections").select("access_token, trello_member_id").eq("team_id", teamId).single();
  if (!conn) return NextResponse.json({ error: "Not connected" }, { status: 400 });

  const apiKey = process.env.TRELLO_API_KEY!;
  const res = await fetch(`https://api.trello.com/1/members/${conn.trello_member_id}/boards?fields=id,name&filter=open&key=${apiKey}&token=${encodeURIComponent(conn.access_token)}`);
  const boards = await res.json();
  return NextResponse.json({ boards });
}

export async function POST(request: NextRequest) {
  const { teamId, boardId } = await request.json() as { teamId: string; boardId: string };
  if (!teamId || !UUID_RE.test(teamId) || !boardId) return NextResponse.json({ error: "valid teamId and boardId required" }, { status: 400 });

  // Registering a webhook is a privileged, mutating action — require entrepreneur.
  const auth = await getTeamAuth(teamId);
  if (!auth) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!auth.isEntrepreneur) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: conn } = await admin.from("trello_connections").select("access_token").eq("team_id", teamId).single();
  if (!conn) return NextResponse.json({ error: "Not connected" }, { status: 400 });

  const apiKey = process.env.TRELLO_API_KEY!;
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/trello/webhook/${teamId}`;

  // Register webhook on the board
  const webhookRes = await fetch(`https://api.trello.com/1/webhooks?key=${apiKey}&token=${encodeURIComponent(conn.access_token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: "SpinUp sync", callbackURL: webhookUrl, idModel: boardId }),
  });
  const webhook = await webhookRes.json() as { id?: string };

  await admin.from("trello_connections").update({ board_id: boardId, webhook_id: webhook.id ?? null }).eq("team_id", teamId);
  return NextResponse.json({ ok: true });
}
