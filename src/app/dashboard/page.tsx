
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EmptyFolders from "@/components/dashboard/emptyFolders";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: folders } = await supabase
    .from("folders")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (folders && folders.length > 0) {
    redirect(`/dashboard/${folders[0].id}`);
  }

  return <EmptyFolders />;
}