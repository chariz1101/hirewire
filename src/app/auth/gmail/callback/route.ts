// app/auth/gmail/callback/route.ts
// Google redirects here after the user grants Gmail access.
// Verifies the anti-CSRF nonce, exchanges the auth code for access +
// refresh tokens, then stores them in the integrations table.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OAUTH_STATE_COOKIE, stateCookieOptions } from "@/lib/gmail-oauth";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Burn the one-shot nonce so it can never be replayed. */
function clearState(response: NextResponse) {
  response.cookies.set(OAUTH_STATE_COOKIE, "", stateCookieOptions(0));
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Identity comes from the session cookie — NEVER from the query string.
  // Trusting a URL parameter here would let an attacker link their own
  // Gmail account to somebody else's HireWire account.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return clearState(NextResponse.redirect(`${origin}/auth`));
  }

  // Verify the nonce before acting on anything else in the request.
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!state || !expectedState || state !== expectedState) {
    return clearState(NextResponse.redirect(`${origin}/dashboard?gmail=error`));
  }

  // User denied access at the consent screen
  if (error || !code) {
    return clearState(NextResponse.redirect(`${origin}/dashboard?gmail=denied`));
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
    return clearState(NextResponse.redirect(`${origin}/dashboard?gmail=error`));
  }

  const tokens = await tokenResponse.json();
  const { access_token, refresh_token, expires_in } = tokens;

  if (!refresh_token) {
    // This happens if the user already granted access before and didn't re-consent.
    // The prompt=consent in /auth/gmail should prevent this, but handle it just in case.
    console.error("No refresh token returned — user may need to revoke and reconnect.");
    return clearState(NextResponse.redirect(`${origin}/dashboard?gmail=no_refresh_token`));
  }

  // ── Store tokens in Supabase integrations table ────────────────────────
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  // Written through a security-definer function rather than a direct upsert.
  // The browser role has no insert/update privilege on `integrations` at all,
  // and the function pins the row to auth.uid(), so tokens can be written but
  // never read back by the client.
  const { error: dbError } = await supabase.rpc("set_gmail_integration", {
    p_access_token:     access_token,
    p_refresh_token:    refresh_token,
    p_token_expires_at: expiresAt,
    p_scope:            "https://www.googleapis.com/auth/gmail.readonly",
  });

  if (dbError) {
    console.error("Failed to save Gmail integration:", dbError);
    return clearState(NextResponse.redirect(`${origin}/dashboard?gmail=error`));
  }

  return clearState(NextResponse.redirect(`${origin}/dashboard?gmail=connected`));
}
