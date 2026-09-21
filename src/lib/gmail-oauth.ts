// lib/gmail-oauth.ts
// Shared constants for the Gmail OAuth flow (/auth/gmail → /auth/gmail/callback).

/**
 * Name of the anti-CSRF nonce cookie exchanged between the two halves of the
 * Gmail OAuth flow. Set httpOnly so page scripts can never read it, and
 * SameSite=Lax so the browser still sends it on the top-level redirect back
 * from Google.
 */
export const OAUTH_STATE_COOKIE = "gmail_oauth_state";

/** Cookie options shared by the set (maxAge 600) and clear (maxAge 0) paths. */
export function stateCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path:     "/",
  };
}
