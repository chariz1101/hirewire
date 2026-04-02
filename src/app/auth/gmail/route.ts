// app/auth/gmail/route.ts
// Initiates the Google OAuth flow specifically for Gmail read access.
// This is separate from the Supabase Google login — this one requests
// the Gmail readonly scope so the backend can scan the user's inbox.

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

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
    state:         user.id,     // pass user id through so callback knows who this is
  });

  redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}