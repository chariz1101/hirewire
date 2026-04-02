"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Application, AppStatus } from "./ApplicationsView";

const STATUSES: AppStatus[] = [
  "Applied", "Reply Received", "Interview", "Offer", "Rejected", "Withdrawn",
];
const REMINDERS = [
  { value: 3,  label: "3 days" },
  { value: 7,  label: "1 week" },
  { value: 14, label: "2 weeks" },
];

type Props = {
  folderId: string;
  application: Application | null;
  onSaved: (app: Application, isNew: boolean) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
};

export default function ApplicationModal({
  folderId, application, onSaved, onDeleted, onClose,
}: Props) {
  const supabase   = createClient();
  const overlayRef = useRef<HTMLDivElement>(null);
  const isNew      = application === null;

  const [form, setForm] = useState({
    job_title:           application?.job_title           ?? "",
    company_name:        application?.company_name        ?? "",
    company_email:       application?.company_email       ?? "",
    job_url:             application?.job_url             ?? "",
    notes:               application?.notes               ?? "",
    status:              (application?.status             ?? "Applied") as AppStatus,
    reminder_preference: application?.reminder_preference ?? 7,
    date_applied:        application?.date_applied        ?? new Date().toISOString().split("T")[0],
  });

  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      job_title:           form.job_title.trim(),
      company_name:        form.company_name.trim(),
      company_email:       form.company_email.trim() || null,
      job_url:             form.job_url.trim()       || null,
      notes:               form.notes.trim()         || null,
      status:              form.status,
      reminder_preference: form.reminder_preference,
      date_applied:        form.date_applied,
    };

    if (isNew) {
      const { data, error } = await supabase
        .from("applications")
        .insert({ ...payload, folder_id: folderId })
        .select().single();
      if (error) { setError(error.message); setLoading(false); return; }
      onSaved(data as Application, true);
    } else {
      const { data, error } = await supabase
        .from("applications")
        .update(payload).eq("id", application.id)
        .select().single();
      if (error) { setError(error.message); setLoading(false); return; }
      onSaved(data as Application, false);
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return; }
    setLoading(true);
    const { error } = await supabase.from("applications").delete().eq("id", application!.id);
    if (error) { setError(error.message); setLoading(false); return; }
    onDeleted(application!.id);
  }

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-blue-100 bg-slate-50 text-slate-900 text-sm placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all font-sans";
  const labelCls = "block text-[10px] font-mono tracking-widest uppercase text-slate-500 mb-1.5";

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4"
    >
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-blue-50">

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-0 sticky top-0 bg-white z-10">
          <div>
            <div className="w-5 h-0.5 bg-blue-600 mb-2" />
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">
              {isNew ? "Add application" : "Edit application"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors text-sm leading-none"
          >✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-7 py-5 space-y-4">
          {/* Job title — full width */}
          <div>
            <label className={labelCls}>Job title <span className="text-blue-600">*</span></label>
            <input
              className={inputCls}
              value={form.job_title}
              onChange={e => set("job_title", e.target.value)}
              placeholder="e.g. Frontend Engineer"
              required autoFocus
            />
          </div>

          {/* Company + email row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Company <span className="text-blue-600">*</span></label>
              <input
                className={inputCls}
                value={form.company_name}
                onChange={e => set("company_name", e.target.value)}
                placeholder="Acme Corp"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Company email</label>
              <input
                type="email"
                className={inputCls}
                value={form.company_email}
                onChange={e => set("company_email", e.target.value)}
                placeholder="hr@acme.com"
              />
            </div>
          </div>

          {/* URL */}
          <div>
            <label className={labelCls}>Job posting URL</label>
            <input
              type="url"
              className={inputCls}
              value={form.job_url}
              onChange={e => set("job_url", e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Status + date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={inputCls}
                value={form.status}
                onChange={e => set("status", e.target.value)}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date applied</label>
              <input
                type="date"
                className={inputCls}
                value={form.date_applied}
                onChange={e => set("date_applied", e.target.value)}
                required
              />
            </div>
          </div>

          {/* Reminder */}
          <div>
            <label className={labelCls}>Reminder preference</label>
            <div className="flex gap-2">
              {REMINDERS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set("reminder_preference", r.value)}
                  className={`flex-1 py-2 rounded-xl border font-mono text-xs font-medium transition-all ${
                    form.reminder_preference === r.value
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-blue-100 bg-slate-50 text-slate-400 hover:border-blue-600/40 hover:text-slate-900"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={`${inputCls} resize-y min-h-[72px]`}
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Referral, contact name, interview notes…"
              rows={3}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-blue-50">
            {!isNew ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                  confirming
                    ? "bg-red-500 border-red-500 text-white hover:bg-red-600"
                    : "border-red-100 text-red-400 hover:bg-red-50"
                }`}
              >
                {confirming ? "Confirm delete" : "Delete"}
              </button>
            ) : <div />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-blue-100 text-slate-400 text-sm hover:border-blue-200 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white font-mono text-xs font-medium tracking-wide hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Saving…" : isNew ? "Add application" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}