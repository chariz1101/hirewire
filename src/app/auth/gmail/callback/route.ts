// app/auth/gmail/callback/route.ts
// Google redirects here after the user grants Gmail access.
// Exchanges the auth code for access + refresh tokens,
// then stores them in the integrations table.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code   = searchParams.get("code");
  const userId = searchParams.get("state");  // passed through from /auth/gmail
  const error  = searchParams.get("error");

  // User denied access
  if (error || !code || !userId) {
    return NextResponse.redirect(`${origin}/dashboard?gmail=denied`);
  }

  // ── Exchange auth code for tokens ──────────────────────────────────────
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${process.env.NEXT_PUBLIC_APP_URL}/auth/gmail/callback`,
      grant_type:    "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    console.error("Gmail token exchange failed:", await tokenResponse.text());
    return NextResponse.redirect(`${origin}/dashboard?gmail=error`);
  }

  const tokens = await tokenResponse.json();
  const { access_token, refresh_token, expires_in } = tokens;

  if (!refresh_token) {
    // This happens if the user already granted access before and didn't re-consent.
    // The prompt=consent in /auth/gmail should prevent this, but handle it just in case.
    console.error("No refresh token returned — user may need to revoke and reconnect.");
    return NextResponse.redirect(`${origin}/dashboard?gmail=no_refresh_token`);
  }

  // ── Store tokens in Supabase integrations table ────────────────────────
  const supabase = await createClient();

  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  const { error: dbError } = await supabase
    .from("integrations")
    .upsert(
      {
        user_id:          userId,
        provider:         "gmail",
        access_token,
        refresh_token,
        token_expires_at: expiresAt,
        scope:            "https://www.googleapis.com/auth/gmail.readonly",
      },
      { onConflict: "user_id,provider" }  // update if already exists
    );

  if (dbError) {
    console.error("Failed to save Gmail integration:", dbError);
    return NextResponse.redirect(`${origin}/dashboard?gmail=error`);
  }

  return NextResponse.redirect(`${origin}/dashboard?gmail=connected`);
}