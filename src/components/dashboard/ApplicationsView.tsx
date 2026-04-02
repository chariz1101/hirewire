"use client";

import { useState } from "react";
import ApplicationModal from "./ApplicationModal";

export type AppStatus =
  | "Applied" | "Reply Received" | "Interview"
  | "Offer"   | "Rejected"       | "Withdrawn";

export type Application = {
  id: string; folder_id: string; user_id: string;
  job_title: string; company_name: string;
  company_email: string | null; job_url: string | null;
  notes: string | null; status: AppStatus;
  reminder_preference: number | null; date_applied: string;
  last_email_received: string | null; created_at: string;
};

const STATUS_STYLE: Record<AppStatus, string> = {
  "Applied":        "bg-blue-100 text-blue-700",
  "Reply Received": "bg-teal-100 text-teal-700",
  "Interview":      "bg-amber-100 text-amber-700",
  "Offer":          "bg-green-100 text-green-700",
  "Rejected":       "bg-red-100 text-red-600",
  "Withdrawn":      "bg-slate-100 text-slate-500",
};

export default function ApplicationsView({
  folder,
  initialApplications,
}: {
  folder: { id: string; name: string };
  initialApplications: Application[];
}) {
  const [apps, setApps]       = useState<Application[]>(initialApplications);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);

  function openNew()              { setEditing(null);  setModalOpen(true); }
  function openEdit(app: Application) { setEditing(app); setModalOpen(true); }

  function handleSaved(app: Application, isNew: boolean) {
    setApps(isNew ? [app, ...apps] : apps.map(a => a.id === app.id ? app : a));
    setModalOpen(false);
  }
  function handleDeleted(id: string) {
    setApps(apps.filter(a => a.id !== id));
    setModalOpen(false);
  }

  return (
    <div className="flex flex-col min-h-full">

      {/* Header */}
      <header className="flex items-center justify-between px-10 py-7 bg-white border-b border-blue-100 sticky top-0 z-10">
        <div>
          <div className="w-6 h-0.5 bg-blue-600 mb-2" />
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{folder.name}</h1>
          <p className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mt-0.5">
            {apps.length} application{apps.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-mono text-xs font-medium tracking-wide hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
          + Add application
        </button>
      </header>

      {/* Empty state */}
      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 py-24 text-center px-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-2xl mb-2">📋</div>
          <p className="text-base font-semibold text-slate-900">No applications yet</p>
          <p className="text-sm text-slate-500 max-w-xs">Add your first one to start tracking your job hunt.</p>
          <button
            onClick={openNew}
            className="mt-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-mono text-xs font-medium tracking-wide hover:bg-blue-700 transition-colors"
          >
            + Add application
          </button>
        </div>
      ) : (
        <div className="px-10 py-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-blue-100">
                {["Role", "Company", "Date applied", "Status", "Reminder", ""].map((h, i) => (
                  <th
                    key={i}
                    className="text-left font-mono text-[9px] tracking-widest uppercase text-slate-500 pb-3 pr-4 font-normal"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => openEdit(app)}
                  className="border-b border-blue-50 hover:bg-slate-50 cursor-pointer group transition-colors"
                >
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{app.job_title}</span>
                      {app.job_url && (
                        <a
                          href={app.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-400 hover:text-blue-600 text-xs transition-colors"
                        >↗</a>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 text-slate-500">{app.company_name}</td>
                  <td className="py-3.5 pr-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(app.date_applied).toLocaleDateString("en-PH", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full font-mono text-[10px] font-medium tracking-wide ${STATUS_STYLE[app.status]}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 font-mono text-[11px] text-slate-500">
                    {app.reminder_preference ? `${app.reminder_preference}d` : "—"}
                  </td>
                  <td className="py-3.5 text-right">
                    <span className="font-mono text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Edit →
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ApplicationModal
          folderId={folder.id}
          application={editing}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
} 