import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Trello sends a HEAD request to verify the webhook URL — respond 200
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

/**
 * Verify Trello's webhook signature:
 *   base64( HMAC-SHA1( requestBody + callbackURL, apiSecret ) ) === x-trello-webhook
 * Without this, anyone could POST forged board events to this endpoint.
 */
function verifyTrelloSignature(rawBody: string, callbackURL: string, signature: string | null): boolean {
  const secret = process.env.TRELLO_API_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha1", secret).update(rawBody + callbackURL).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Trello sends POST for each board event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;

  const rawBody = await request.text();
  const callbackURL = `${process.env.NEXT_PUBLIC_APP_URL}/api/trello/webhook/${teamId}`;
  const signature = request.headers.get("x-trello-webhook");

  if (!verifyTrelloSignature(rawBody, callbackURL, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: {
    action?: {
      type?: string;
      data?: {
        card?: { id?: string; name?: string };
        list?: { name?: string };
        listAfter?: { name?: string };
      };
    };
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body?.action;
  if (!action) return NextResponse.json({ ok: true });

  // Authenticated by HMAC above, so use the admin client for the trusted writes.
  const admin = createAdminClient();

  // Only handle card moves (updateCard with listAfter = Done/Complete)
  if (action.type === "updateCard" && action.data?.card?.id) {
    const listName = action.data.listAfter?.name?.toLowerCase() ?? "";
    const isDone = listName.includes("done") || listName.includes("complete") || listName.includes("finished");

    // Find artifact mapped to this card
    const { data: mapping } = await admin
      .from("trello_card_mappings")
      .select("artifact_id")
      .eq("trello_card_id", action.data.card.id)
      .eq("team_id", teamId)
      .single();

    if (mapping && isDone) {
      await admin.from("artifacts").update({ status: "complete", updated_at: new Date().toISOString() }).eq("id", mapping.artifact_id);
      await admin.from("trello_card_mappings").update({ last_pulled_at: new Date().toISOString() }).eq("artifact_id", mapping.artifact_id);
    }

    // Update last_synced_at on connection
    await admin.from("trello_connections").update({ last_synced_at: new Date().toISOString() }).eq("team_id", teamId);
  }

  return NextResponse.json({ ok: true });
}
