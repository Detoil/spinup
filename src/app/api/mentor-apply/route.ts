import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { escapeHtml } from "@/lib/html";

// This is a public, unauthenticated endpoint, so validate strictly and cap
// lengths to limit abuse (inbox spam / oversized payloads).
const mentorApplySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  companies: z.string().trim().min(1).max(1000),
  industries: z.string().trim().min(1).max(1000),
  message: z.string().trim().max(4000).optional().nullable(),
});

// Best-effort in-memory rate limit (per-IP). Not durable across instances, but
// blunts trivial floods from a single source.
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured." },
      { status: 503 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = mentorApplySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
  }
  const { name, email, companies, industries, message } = parsed.data;

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: "SpinUp Mentors <onboarding@resend.dev>",
    to: "fred@parkvs.co.za",
    replyTo: email,
    subject: `Mentor application — ${name}`,
    html: `
      <h2>New mentor application</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Companies:</strong> ${escapeHtml(companies)}</p>
      <p><strong>Industries:</strong> ${escapeHtml(industries)}</p>
      ${message ? `<p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, "<br>")}</p>` : ""}
    `,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
