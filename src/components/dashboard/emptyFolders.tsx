"use client";

export default function EmptyFolders() {
  return (
    <div className="flex items-center justify-center h-full px-6 py-20 font-sans">
      <div className="max-w-sm text-center flex flex-col items-center gap-3">
        <div className="w-5 h-0.5 bg-brand-blue mb-1" />
        <div className="w-14 h-14 rounded-2xl bg-brand-blue/10 flex items-center justify-center font-mono text-brand-blue text-2xl mb-1">
          ⌁
        </div>
        <h2 className="text-lg font-semibold text-brand-navy tracking-tight">
          Welcome to HireWire
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Create your first workspace folder in the sidebar to start tracking.
          Try <span className="text-brand-navy font-medium">OJT 2026</span> or{" "}
          <span className="text-brand-navy font-medium">Remote Roles</span>.
        </p>
        <div className="flex items-center gap-2 mt-2 font-mono text-[10px] tracking-widest uppercase text-gray-300">
          <span className="text-brand-blue animate-bounce">←</span>
          Use the sidebar to create a folder
        </div>
      </div>
    </div>
  );
}