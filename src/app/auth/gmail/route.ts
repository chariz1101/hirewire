// app/auth/gmail/route.ts
// Initiates the Google OAuth flow specifically for Gmail read access.
// This is separate from the Supabase Google login — this one requests
// the Gmail readonly scope so the backend can scan the user's inbox.

import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE, stateCookieOptions } from "@/lib/gmail-oauth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(`${origin}/auth`);

  // A fresh, unguessable nonce per request. Never the user id — that is
  // predictable and lets an attacker forge a callback for someone else.
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  `${process.env.NEXT_PUBLIC_APP_URL}/auth/gmail/callback`,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "email",
    ].join(" "),
    access_type:   "offline",   // gets us a refresh token
    prompt:        "consent",   // forces refresh token even if previously granted
    state,
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);

  // 10 minutes — the consent screen should not take longer than that.
  response.cookies.set(OAUTH_STATE_COOKIE, state, stateCookieOptions(600));

  return response;
}
