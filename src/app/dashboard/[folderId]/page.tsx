// app/dashboard/[folderId]/page.tsx
// Shows all applications inside a specific folder.

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ApplicationsView from "@/components/dashboard/applicationsView";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const supabase = await createClient();

  // Verify folder belongs to this user (RLS handles security)
  const { data: folder } = await supabase
    .from("folders")
    .select("id, name")
    .eq("id", folderId)
    .single();

  if (!folder) notFound();

  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("folder_id", folderId)
    .order("date_applied", { ascending: false });

  return (
    <ApplicationsView
      folder={folder}
      initialApplications={applications ?? []}
    />
  );
}