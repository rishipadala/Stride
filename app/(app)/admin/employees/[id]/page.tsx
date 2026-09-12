import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import HistoryView from "@/components/HistoryView";

export default async function EmployeeHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "ADMIN") redirect("/today");
  const { data: emp } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!emp) redirect("/admin/employees");

  return (
    <div className="stagger">
      <div style={{ marginBottom: "1.5rem" }}>
        {/* next/link, not a bare <a> — going back to the list was a
            full document reload, which on this shell means the sidebar
            and the whole page repaint from white. */}
        <Link href="/admin/employees" style={{ color: "var(--text-muted)", fontSize: ".85rem", textDecoration: "none" }}>
          &larr; Back to Employees
        </Link>
      </div>
      <HistoryView userId={id} employeeName={emp.full_name} />
    </div>
  );
}