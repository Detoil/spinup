import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Only allow same-origin relative paths to prevent open redirects
  // (e.g. `next=//evil.com` or `next=@evil.com`).
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If there's no code or exchange failed, redirect to sign-in with error
  return NextResponse.redirect(
    `${origin}/sign-in?error=${encodeURIComponent(
      "Authentication failed. Please try again."
    )}`
  );
}
