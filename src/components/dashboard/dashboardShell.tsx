"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Folder = { id: string; name: string; created_at: string };

export default function DashboardShell({
  user,
  initialFolders,
  children,
}: {
  user: User;
  initialFolders: Folder[];
  children: React.ReactNode;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [folders, setFolders]           = useState<Folder[]>(initialFolders);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating]         = useState(false);
  const [showInput, setShowInput]       = useState(false);
  const [renamingId, setRenamingId]     = useState<string | null>(null);
  const [renameValue, setRenameValue]   = useState("");

  const activeFolderId = pathname.split("/")[2] ?? null;

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

                  {/* Rename / delete */}
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

        {/* User footer */}
        <div className="border-t border-white/5 px-4 py-4 flex flex-col gap-2">
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
      </aside>

      {/* ── Main panel ── */}
      <main className="flex-1 overflow-y-auto bg-brand-light min-w-0">
        {children}
      </main>
    </div>
  );
}