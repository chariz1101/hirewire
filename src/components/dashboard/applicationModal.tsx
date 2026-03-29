"use client";

// components/dashboard/ApplicationModal.tsx
// Modal for adding a new application or editing an existing one.

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Application, AppStatus } from "./applicationsView";
import styles from "./ApplicationModal.module.css";

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
  const supabase = createClient();
  const overlayRef = useRef<HTMLDivElement>(null);
  const isNew = application === null;

  const [form, setForm] = useState({
    job_title:           application?.job_title ?? "",
    company_name:        application?.company_name ?? "",
    company_email:       application?.company_email ?? "",
    job_url:             application?.job_url ?? "",
    notes:               application?.notes ?? "",
    status:              application?.status ?? "Applied" as AppStatus,
    reminder_preference: application?.reminder_preference ?? 7,
    date_applied:        application?.date_applied ?? new Date().toISOString().split("T")[0],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
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
      job_url:             form.job_url.trim() || null,
      notes:               form.notes.trim() || null,
      status:              form.status,
      reminder_preference: form.reminder_preference,
      date_applied:        form.date_applied,
    };

    if (isNew) {
      const { data, error } = await supabase
        .from("applications")
        .insert({ ...payload, folder_id: folderId })
        .select()
        .single();

      if (error) { setError(error.message); setLoading(false); return; }
      onSaved(data as Application, true);
    } else {
      const { data, error } = await supabase
        .from("applications")
        .update(payload)
        .eq("id", application.id)
        .select()
        .single();

      if (error) { setError(error.message); setLoading(false); return; }
      onSaved(data as Application, false);
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return; }
    setLoading(true);
    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", application!.id);

    if (error) { setError(error.message); setLoading(false); return; }
    onDeleted(application!.id);
  }

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={styles.modal} role="dialog" aria-modal>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {isNew ? "Add application" : "Edit application"}
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.grid}>
            {/* Job title */}
            <label className={styles.label} style={{ gridColumn: "1 / -1" }}>
              Job title <span className={styles.req}>*</span>
              <input
                className={styles.input}
                value={form.job_title}
                onChange={e => set("job_title", e.target.value)}
                placeholder="e.g. Frontend Engineer"
                required
                autoFocus
              />
            </label>

            {/* Company name */}
            <label className={styles.label}>
              Company <span className={styles.req}>*</span>
              <input
                className={styles.input}
                value={form.company_name}
                onChange={e => set("company_name", e.target.value)}
                placeholder="e.g. Acme Corp"
                required
              />
            </label>

            {/* Company email */}
            <label className={styles.label}>
              Company email
              <input
                className={styles.input}
                type="email"
                value={form.company_email}
                onChange={e => set("company_email", e.target.value)}
                placeholder="hr@acmecorp.com"
              />
            </label>

            {/* Job URL */}
            <label className={styles.label} style={{ gridColumn: "1 / -1" }}>
              Job posting URL
              <input
                className={styles.input}
                type="url"
                value={form.job_url}
                onChange={e => set("job_url", e.target.value)}
                placeholder="https://..."
              />
            </label>

            {/* Status */}
            <label className={styles.label}>
              Status
              <select
                className={styles.select}
                value={form.status}
                onChange={e => set("status", e.target.value)}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            {/* Date applied */}
            <label className={styles.label}>
              Date applied
              <input
                className={styles.input}
                type="date"
                value={form.date_applied}
                onChange={e => set("date_applied", e.target.value)}
                required
              />
            </label>

            {/* Reminder preference */}
            <label className={styles.label} style={{ gridColumn: "1 / -1" }}>
              Reminder preference
              <div className={styles.reminderGroup}>
                {REMINDERS.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    className={`${styles.reminderBtn} ${form.reminder_preference === r.value ? styles.reminderActive : ""}`}
                    onClick={() => set("reminder_preference", r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </label>

            {/* Notes */}
            <label className={styles.label} style={{ gridColumn: "1 / -1" }}>
              Notes
              <textarea
                className={styles.textarea}
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                placeholder="Referral, contact name, interview notes…"
                rows={3}
              />
            </label>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            {!isNew && (
              <button
                type="button"
                className={`${styles.deleteBtn} ${confirming ? styles.deleteBtnConfirm : ""}`}
                onClick={handleDelete}
                disabled={loading}
              >
                {confirming ? "Confirm delete" : "Delete"}
              </button>
            )}
            <div className={styles.actionsRight}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={styles.saveBtn} disabled={loading}>
                {loading ? "Saving…" : isNew ? "Add application" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}