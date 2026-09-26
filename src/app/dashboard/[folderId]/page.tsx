// app/dashboard/[folderId]/page.tsx
// Shows all applications inside a specific folder.

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ApplicationsView from "@/components/dashboard/ApplicationsView";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // RLS scopes both queries to the caller already; the explicit
  // user_id filter is defense-in-depth in case a policy ever regresses.
  const { data: folder } = await supabase
    .from("folders")
    .select("id, name")
    .eq("id", folderId)
    .eq("user_id", user.id)
    .single();

  if (!folder) notFound();

  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("folder_id", folderId)
    .eq("user_id", user.id)
    .order("date_applied", { ascending: false });

  return (
    <ApplicationsView
      folder={folder}
      initialApplications={applications ?? []}
    />
  );
}