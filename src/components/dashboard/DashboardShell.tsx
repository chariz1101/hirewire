"use client";

// components/dashboard/DashboardShell.tsx
// Updated for Phase 4: Gmail connect/disconnect button in sidebar footer.

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Folder = { id: string; name: string; created_at: string };

export default function DashboardShell({
  user,
  initialFolders,
  gmailConnected: initialGmailConnected,
  children,
}: {
  user: User;
  initialFolders: Folder[];
  gmailConnected: boolean;
  children: React.ReactNode;
}) {
  const router        = useRouter();
  const pathname      = usePathname();
  const searchParams  = useSearchParams();
  const supabase      = createClient();

  const [folders, setFolders]             = useState<Folder[]>(initialFolders);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating]           = useState(false);
  const [showInput, setShowInput]         = useState(false);
  const [renamingId, setRenamingId]       = useState<string | null>(null);
  const [renameValue, setRenameValue]     = useState("");
  const [gmailConnected, setGmailConnected] = useState(initialGmailConnected);
  const [gmailNotice, setGmailNotice]     = useState<string | null>(null);

  const activeFolderId = pathname.split("/")[2] ?? null;

  // Handle ?gmail= query param set by OAuth callback
  useEffect(() => {
    const status = searchParams.get("gmail");
    if (!status) return;

    if (status === "connected") {
      setGmailConnected(true);
      setGmailNotice("Gmail connected! Your inbox will be scanned daily.");
    } else if (status === "denied") {
      setGmailNotice("Gmail access was denied.");
    } else if (status === "error" || status === "no_refresh_token") {
      setGmailNotice("Something went wrong. Try connecting again.");
    }

    // Clean the query param from the URL without a full reload
    const url = new URL(window.location.href);
    url.searchParams.delete("gmail");
    window.history.replaceState({}, "", url.toString());

    const timer = setTimeout(() => setGmailNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [searchParams]);

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("folders")
      .insert({ name: newFolderName.trim(), user_id: user.id })
      .select()
      .single();
    if (!error && data) {
      setFolders([...folders, data]);
      setNewFolderName("");
      setShowInput(false);
      router.push(`/dashboard/${data.id}`);
    }
    setCreating(false);
  }

  async function renameFolder(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    const { error } = await supabase
      .from("folders").update({ name: renameValue.trim() }).eq("id", id);
    if (!error)
      setFolders(folders.map(f => f.id === id ? { ...f, name: renameValue.trim() } : f));
    setRenamingId(null);
  }

  async function deleteFolder(id: string) {
    if (!confirm("Delete this folder and all its applications?")) return;
    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (!error) {
      const remaining = folders.filter(f => f.id !== id);
      setFolders(remaining);
      if (activeFolderId === id)
        router.push(remaining.length > 0 ? `/dashboard/${remaining[0].id}` : "/dashboard");
    }
  }

  async function disconnectGmail() {
    if (!confirm("Disconnect Gmail? Inbox scanning will stop.")) return;
    const { error } = await supabase
      .from("integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "gmail");
    if (!error) {
      setGmailConnected(false);
      setGmailNotice("Gmail disconnected.");
      setTimeout(() => setGmailNotice(null), 4000);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-brand-light">

      {/* ── Sidebar ── */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-brand-navy h-screen overflow-hidden border-r border-white/5">

        {/* Brand */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/5">
          <span className="text-brand-blue font-mono text-lg leading-none">⌁</span>
          <span className="font-mono text-xs font-medium tracking-widest uppercase text-white">HireWire</span>
        </div>

        {/* Folders */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <p className="font-mono text-[9px] tracking-widest uppercase text-white/20 px-5 pt-5 pb-2">
            Workspaces
          </p>

          <nav className="flex flex-col gap-0.5 px-2 overflow-y-auto flex-1">
            {folders.map((folder) => {
              const isActive = activeFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  className={`group flex items-center rounded-lg transition-colors ${
                    isActive ? "bg-brand-blue/20" : "hover:bg-white/5"
                  }`}
                >
                  {renamingId === folder.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => renameFolder(folder.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameFolder(folder.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="flex-1 mx-1 my-1 px-2 py-1 rounded-md bg-white/10 text-white text-xs outline-none border border-brand-blue/60 font-sans"
                    />
                  ) : (
                    <button
                      onClick={() => router.push(`/dashboard/${folder.id}`)}
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-left min-w-0"
                    >
                      <span className={`text-[9px] flex-shrink-0 ${isActive ? "text-brand-blue" : "text-white/20"}`}>▸</span>
                      <span className={`text-xs truncate ${isActive ? "text-white font-medium" : "text-white/50 group-hover:text-white/80"}`}>
                        {folder.name}
                      </span>
                    </button>
                  )}
                  <div className="flex gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name); }}
                      className="p-1 rounded text-white/30 hover:text-white hover:bg-white/10 text-[10px] leading-none transition-colors"
                      title="Rename"
                    >✎</button>
                    <button
                      onClick={() => deleteFolder(folder.id)}
                      className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-white/10 text-[10px] leading-none transition-colors"
                      title="Delete"
                    >✕</button>
                  </div>
                </div>
              );
            })}
          </nav>

          {/* New folder */}
          <div className="px-2 pb-3 pt-2">
            {showInput ? (
              <form onSubmit={createFolder} className="flex gap-1">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setShowInput(false)}
                  placeholder="Folder name…"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-xs placeholder-white/20 outline-none border border-white/10 focus:border-brand-blue/60 font-sans"
                />
                <button
                  type="submit"
                  disabled={creating}
                  className="px-2.5 py-1.5 rounded-lg bg-brand-blue text-white font-mono text-[10px] font-medium disabled:opacity-50"
                >
                  {creating ? "…" : "Add"}
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowInput(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/10 text-white/30 text-xs hover:border-white/20 hover:text-white/50 transition-colors"
              >
                <span className="text-base leading-none">+</span>
                <span>New folder</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-white/5 px-4 py-4 flex flex-col gap-3">

          {/* Gmail notice toast */}
          {gmailNotice && (
            <p className="text-[10px] text-brand-blue/80 bg-brand-blue/10 rounded-lg px-2.5 py-2 leading-relaxed">
              {gmailNotice}
            </p>
          )}

          {/* Gmail connect / disconnect */}
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[9px] tracking-widest uppercase text-white/20">
              Gmail inbox scan
            </p>
            {gmailConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-[11px] text-emerald-400/80">Connected</span>
                </div>
                <button
                  onClick={disconnectGmail}
                  className="text-[10px] font-mono text-white/20 hover:text-red-400 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <a
                href="/auth/gmail"
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:border-brand-blue/40 hover:bg-brand-blue/10 transition-all group"
              >
                <GmailIcon />
                <span className="text-[11px] text-white/40 group-hover:text-white/70 transition-colors">
                  Connect Gmail
                </span>
              </a>
            )}
          </div>

          {/* User info + sign out */}
          <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-brand-blue flex items-center justify-center font-mono text-[10px] text-white font-medium flex-shrink-0">
                {user.email?.[0].toUpperCase()}
              </div>
              <span className="text-white/30 text-[11px] truncate">{user.email}</span>
            </div>
            <button
              onClick={signOut}
              className="font-mono text-[9px] tracking-widest uppercase text-white/20 hover:text-white/50 text-left transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main panel ── */}
      <main className="flex-1 overflow-y-auto bg-brand-light min-w-0">
        {children}
      </main>
    </div>
  );
}

function GmailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" stroke="#6B7FCC" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M2 7l10 7 10-7" stroke="#6B7FCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}