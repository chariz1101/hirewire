"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The recovery link redirects here with a code that the Supabase client
  // exchanges for a session automatically, firing PASSWORD_RECOVERY.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNotice("Password updated. Redirecting to sign in.");
    setTimeout(() => router.push("/auth"), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Set a new password</h2>
            <p className="text-sm text-slate-500 mt-1">
              {ready
                ? "Choose a new password for your account."
                : "Verifying your reset link…"}
            </p>
          </div>

          {ready && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 tracking-wide uppercase">
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 tracking-wide uppercase">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all duration-150"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                  {error}
                </p>
              )}
              {notice && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-mono text-sm font-medium tracking-wide hover:bg-blue-700 active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              >
                {loading ? "Please wait…" : "Update password"}
              </button>
            </form>
          )}

          {!ready && (
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
              If this takes more than a few seconds, the link may have expired.
              Request a new one from the sign-in page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
