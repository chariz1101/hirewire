// app/dashboard/layout.tsx
// Updated for Phase 4: checks if the user has a Gmail integration
// and passes it down to DashboardShell.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const [{ data: folders }, { data: integration }] = await Promise.all([
    supabase
      .from("folders")
      .select("id, name, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("integrations")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "gmail")
      .maybeSingle(),
  ]);

  return (
    <DashboardShell
      user={user}
      initialFolders={folders ?? []}
      gmailConnected={!!integration}
    >
      {children}
    </DashboardShell>
  );
}