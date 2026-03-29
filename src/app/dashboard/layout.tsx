import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/dashboard/dashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: folders } = await supabase
    .from("folders")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });

  return (
    <DashboardShell user={user} initialFolders={folders ?? []}>
      {children}
    </DashboardShell>
  );
}