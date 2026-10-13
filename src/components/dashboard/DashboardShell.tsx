"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Folder = { id: string; name: string; created_at: string };

function gmailStatusNotice(status: string | null): string | null {
  if (status === "connected") return "Gmail connected! Your inbox will be scanned daily.";
  if (status === "denied") return "Gmail access was denied.";
  if (status === "error" || status === "no_refresh_token") return "Something went wrong. Try connecting again.";
  return null;
}

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
  const [gmailConnected, setGmailConnected] = useState(
    () => initialGmailConnected || searchParams.get("gmail") === "connected"
  );
  const [notice, setNotice] = useState<string | null>(() => gmailStatusNotice(searchParams.get("gmail")));
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery]         = useState("");
  const [tooltip, setTooltip]     = useState<{ label: string; top: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const visibleFolders = query.trim()
    ? folders.filter(f => f.name.toLowerCase().includes(query.trim().toLowerCase()))
    : folders;
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "Account";

  const activeFolderId = pathname.split("/")[2] ?? null;

  function showNotice(message: string, duration = 4000) {
    setNotice(message);
    setTimeout(() => setNotice(null), duration);
  }

  // Clean up the ?gmail= query param set by the OAuth callback, and let its
  // notice (already reflected in initial state above) expire on its own.
  useEffect(() => {
    const status = searchParams.get("gmail");
    if (!status) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("gmail");
    window.history.replaceState({}, "", url.toString());

    const timer = setTimeout(() => setNotice(null), 5000);
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
    } else {
      showNotice("Couldn't create folder. Please try again.");
    }
    setCreating(false);
  }

  async function renameFolder(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    const { error } = await supabase
      .from("folders").update({ name: renameValue.trim() }).eq("id", id);
    if (!error)
      setFolders(folders.map(f => f.id === id ? { ...f, name: renameValue.trim() } : f));
    else
      showNotice("Couldn't rename folder. Please try again.");
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
    } else {
      showNotice("Couldn't delete folder. Please try again.");
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
      showNotice("Gmail disconnected.");
    } else {
      showNotice("Couldn't disconnect Gmail. Please try again.");
    }
  }

  // Mini-sidebar actions that need room expand the sidebar first.
  function expandAndFocusSearch() {
    setCollapsed(false);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function expandAndCreate() {
    setCollapsed(false);
    setShowInput(true);
  }

  // Tooltips render fixed-position so the sidebar's scroll area can't clip them.
  function tip(label: string) {
    if (!collapsed) return {};
    return {
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTooltip({ label, top: r.top + r.height / 2 });
      },
      onMouseLeave: () => setTooltip(null),
      "aria-label": label,
    };
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const itemBase = "flex items-center gap-3 rounded-xl transition-colors";
  const itemPad  = collapsed ? "justify-center h-11 w-11 mx-auto" : "px-3 h-11";

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-brand-light">

      {/* ── Sidebar ── */}
      <aside
        className={`${collapsed ? "w-[84px]" : "w-72"} flex-shrink-0 flex flex-col bg-brand-navy h-screen overflow-hidden transition-[width] duration-200 ease-out`}
      >

        {/* Brand header */}
        <div className={`flex ${collapsed ? "flex-col gap-3" : "gap-3"} items-center px-4 pt-6 pb-5`}>
          <div className="w-11 h-11 rounded-2xl bg-brand-blue flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-blue/30">
            <BoltIcon />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white/45 leading-tight">Application tracker</p>
              <p className="font-display text-lg font-bold text-white leading-tight tracking-tight">HireWire</p>
            </div>
          )}
          <button
            onClick={() => { setCollapsed(c => !c); setTooltip(null); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronsIcon direction={collapsed ? "right" : "left"} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-4">
          {collapsed ? (
            <button
              onClick={expandAndFocusSearch}
              {...tip("Search")}
              className="w-11 h-11 mx-auto rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/55 hover:text-white hover:border-white/20 transition-colors"
            >
              <SearchIcon />
            </button>
          ) : (
            <label className="flex items-center gap-2.5 h-11 px-3 rounded-xl border border-white/10 bg-white/[0.04] focus-within:border-brand-blue/70 focus-within:bg-white/[0.07] transition-colors">
              <span className="text-white/45"><SearchIcon /></span>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                placeholder="Search folders…"
                className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-white/40 outline-none"
              />
            </label>
          )}
        </div>

        <div className="mx-4 border-t border-white/[0.07]" />

        {/* Folders */}
        <div className="flex flex-col flex-1 min-h-0 pt-4">
          {!collapsed && (
            <div className="flex items-center justify-between px-6 pb-2">
              <p className="font-display text-[11px] font-semibold tracking-[0.12em] uppercase text-white/40">
                Workspaces
              </p>
              <span className="font-display text-[11px] font-semibold text-white/40">{folders.length}</span>
            </div>
          )}

          <nav className="flex flex-col gap-1 px-4 overflow-y-auto flex-1">
            {visibleFolders.map((folder) => {
              const isActive = activeFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  className={`group ${itemBase} ${collapsed ? "" : "pr-1.5"} ${
                    isActive ? "bg-white/10" : "hover:bg-white/[0.06]"
                  }`}
                >
                  {renamingId === folder.id && !collapsed ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => renameFolder(folder.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameFolder(folder.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="flex-1 mx-1.5 my-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-sm outline-none border border-brand-blue/60"
                    />
                  ) : (
                    <button
                      onClick={() => router.push(`/dashboard/${folder.id}`)}
                      {...tip(folder.name)}
                      className={`flex-1 flex items-center gap-3 text-left min-w-0 ${itemPad}`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-display text-xs font-bold flex-shrink-0 transition-colors ${
                          isActive ? "bg-brand-blue text-white" : "bg-white/[0.08] text-white/60 group-hover:text-white/85"
                        }`}
                      >
                        {folder.name.trim()[0]?.toUpperCase() ?? "?"}
                      </span>
                      {!collapsed && (
                        <span className={`text-sm truncate ${isActive ? "text-white font-semibold" : "text-white/70 font-medium group-hover:text-white"}`}>
                          {folder.name}
                        </span>
                      )}
                    </button>
                  )}
                  {!collapsed && renamingId !== folder.id && (
                    <div className="hidden group-hover:flex group-focus-within:flex gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/45 hover:text-white hover:bg-white/10 transition-colors"
                        title="Rename"
                        aria-label={`Rename ${folder.name}`}
                      ><PencilIcon /></button>
                      <button
                        onClick={() => deleteFolder(folder.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/45 hover:text-red-400 hover:bg-white/10 transition-colors"
                        title="Delete"
                        aria-label={`Delete ${folder.name}`}
                      ><TrashIcon /></button>
                    </div>
                  )}
                </div>
              );
            })}

            {!collapsed && query.trim() && visibleFolders.length === 0 && (
              <p className="px-3 py-2 text-xs text-white/40">No folders match “{query.trim()}”.</p>
            )}
          </nav>

          {/* New folder */}
          <div className="px-4 pt-2 pb-4">
            {showInput && !collapsed ? (
              <form onSubmit={createFolder} className="flex gap-1.5">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setShowInput(false)}
                  placeholder="Folder name…"
                  className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-white/[0.06] text-white text-sm placeholder-white/40 outline-none border border-white/10 focus:border-brand-blue/70"
                />
                <button
                  type="submit"
                  disabled={creating}
                  className="h-10 px-3.5 rounded-xl bg-brand-blue text-white font-display text-sm font-semibold disabled:opacity-50"
                >
                  {creating ? "…" : "Add"}
                </button>
              </form>
            ) : (
              <button
                onClick={expandAndCreate}
                {...tip("New folder")}
                className={`${itemBase} ${itemPad} ${collapsed ? "" : "w-full"} border border-dashed border-white/15 text-white/55 text-sm font-medium hover:border-white/30 hover:text-white transition-colors`}
              >
                <PlusIcon />
                {!collapsed && <span>New folder</span>}
              </button>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-4 pt-4 pb-5 border-t border-white/[0.07] flex flex-col gap-1">

          {notice && !collapsed && (
            <p className="mb-2 text-xs text-white/80 bg-brand-blue/20 border border-brand-blue/30 rounded-xl px-3 py-2.5 leading-relaxed">
              {notice}
            </p>
          )}

          {/* Gmail connect / disconnect */}
          {gmailConnected ? (
            <div className={`group ${itemBase} ${itemPad} hover:bg-white/[0.06]`} {...tip("Gmail connected")}>
              <span className="relative text-white/60">
                <MailIcon />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-brand-navy" />
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-sm font-medium text-white/70">Gmail sync</span>
                  <span className="text-[11px] font-semibold text-emerald-400 group-hover:hidden">On</span>
                  <button
                    onClick={disconnectGmail}
                    className="hidden group-hover:block text-[11px] font-semibold text-white/50 hover:text-red-400 transition-colors"
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>
          ) : (
            <a href="/auth/gmail" {...tip("Connect Gmail")} className={`group ${itemBase} ${itemPad} hover:bg-white/[0.06]`}>
              <span className="text-white/60 group-hover:text-white"><MailIcon /></span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-sm font-medium text-white/70 group-hover:text-white">Connect Gmail</span>
                  <span className="text-[11px] font-semibold text-brand-blue bg-white rounded-md px-1.5 py-0.5">Off</span>
                </>
              )}
            </a>
          )}

          <button
            onClick={signOut}
            {...tip("Log out")}
            className={`group ${itemBase} ${itemPad} hover:bg-white/[0.06] text-left`}
          >
            <span className="text-white/60 group-hover:text-white"><LogOutIcon /></span>
            {!collapsed && <span className="text-sm font-medium text-white/70 group-hover:text-white">Log out</span>}
          </button>

          {/* User card */}
          <div className={`mt-3 pt-4 border-t border-white/[0.07] flex items-center gap-3 ${collapsed ? "justify-center" : "px-1"}`} {...tip(user.email ?? displayName)}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-blue to-brand-muted flex items-center justify-center font-display text-sm text-white font-bold flex-shrink-0">
              {displayName[0]?.toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-display text-sm font-bold text-white truncate">{displayName}</p>
                <p className="text-xs text-white/50 truncate">{user.email}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mini-sidebar tooltip */}
      {collapsed && tooltip && (
        <div
          role="tooltip"
          className="fixed z-50 left-[92px] -translate-y-1/2 pointer-events-none px-2.5 py-1.5 rounded-lg bg-white text-brand-navy text-xs font-semibold shadow-lg shadow-brand-navy/20 whitespace-nowrap"
          style={{ top: tooltip.top }}
        >
          <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-white" />
          {tooltip.label}
        </div>
      )}

      {/* ── Main panel ── */}
      <main className="flex-1 overflow-y-auto bg-brand-light min-w-0">
        {children}
      </main>
    </div>
  );
}

function Icon({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
      <path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5L13.5 2Z" />
    </svg>
  );
}

function ChevronsIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <Icon size={16}>
      {direction === "left"
        ? <><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></>
        : <><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></>}
    </Icon>
  );
}

function SearchIcon() {
  return <Icon size={16}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>;
}

function PlusIcon() {
  return <Icon><path d="M12 5v14" /><path d="M5 12h14" /></Icon>;
}

function PencilIcon() {
  return <Icon size={14}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></Icon>;
}

function TrashIcon() {
  return <Icon size={14}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Icon>;
}

function MailIcon() {
  return <Icon><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 7L2 7" /></Icon>;
}

function LogOutIcon() {
  return <Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Icon>;
}
