"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup" | "forgot";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearMessages = () => { setError(null); setNotice(null); };

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/reset`,
      });
      if (error) setError(error.message);
      else setNotice("Check your email for a reset link.");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setNotice("Check your email to confirm your account.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.push("/dashboard");
    setLoading(false);
  }

  async function handleGoogleAuth() {
    clearMessages();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  const isLogin  = mode === "login";
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  return (
    <div className="flex min-h-screen font-sans">
      <div className="hidden lg:flex flex-col justify-between w-[46%] bg-slate-900 px-14 py-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600 opacity-60 rounded-full translate-x-16 -translate-y-16" />
        <div className="absolute bottom-24 left-0 w-32 h-32 bg-blue-600 opacity-10 -translate-x-10" />
        <div className="absolute bottom-0 right-12 w-24 h-24 bg-blue-600 opacity-40 rotate-45 translate-y-8" />

        <div className="relative flex items-center gap-2">
          <span className="text-blue-600 font-mono text-2xl font-medium leading-none">⌁</span>
          <span className="text-white font-mono text-sm font-medium tracking-widest uppercase">HireWire</span>
        </div>

        <div className="relative">
          <div className="w-8 h-0.5 bg-blue-600 mb-6" />
          <h1 className="text-4xl font-semibold text-white leading-tight tracking-tight mb-4">
            Every application.<br />One command<br />center.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            Track your job hunt, get automated reminders, and catch every reply — automatically.
          </p>
        </div>

        <ul className="relative space-y-4">
          {[
            { icon: "⌛", text: "Reminders at 3 days, 1 week, 2 weeks" },
            { icon: "📬", text: "Gmail inbox scanning for replies" },
            { icon: "📁", text: "Custom workspace folders" },
          ].map(({ icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-blue-600/40 flex items-center justify-center text-sm flex-shrink-0">
                {icon}
              </span>
              <span className="text-slate-400 text-sm">{text}</span>
            </li>
          ))}
          <li className="pt-2">
            <span className="font-mono text-[10px] tracking-widest uppercase text-blue-400/80">
              Free forever for job seekers
            </span>
          </li>
        </ul>
      </div>

      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <span className="text-blue-600 font-mono text-xl">⌁</span>
            <span className="font-mono text-sm font-medium tracking-widest uppercase text-slate-900">HireWire</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            {!isForgot && (
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-7">
                {(["login", "signup"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); clearMessages(); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      mode === m
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {m === "login" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>
            )}

            {isForgot && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900">Reset password</h2>
                <p className="text-sm text-slate-500 mt-1">We'll send a reset link to your email.</p>
              </div>
            )}

            {!isForgot && (
              <>
                <button
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm font-medium hover:bg-slate-50 hover:border-blue-600/30 transition-all duration-150 disabled:opacity-50"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 font-mono">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              </>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 tracking-wide uppercase">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  autoComplete="email"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all duration-150"
                />
              </div>

              {!isForgot && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 tracking-wide uppercase">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignup ? "At least 8 characters" : "••••••••"}
                    required
                    minLength={8}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all duration-150"
                  />
                </div>
              )}

              {error  && (
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
                {loading
                  ? "Please wait…"
                  : isForgot
                  ? "Send reset link"
                  : isSignup
                  ? "Create account"
                  : "Sign in"}
              </button>
            </form>

            <div className="mt-5 text-center">
              {!isForgot && isLogin && (
                <button
                  onClick={() => { setMode("forgot"); clearMessages(); }}
                  className="text-xs text-slate-500 underline underline-offset-2 hover:text-blue-600 transition-colors"
                >
                  Forgot password?
                </button>
              )}
              {isForgot && (
                <button
                  onClick={() => { setMode("login"); clearMessages(); }}
                  className="text-xs text-slate-500 underline underline-offset-2 hover:text-blue-600 transition-colors"
                >
                  ← Back to sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}