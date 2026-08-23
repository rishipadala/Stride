import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { statusDotClass, statusLabel } from "@/lib/utils";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "ADMIN") redirect("/today");

  const today = new Date().toISOString().split("T")[0];
  const { data: employees } = await supabase.from("profiles").select("id, full_name, email, employment_type, role").order("full_name");
  const { data: todayAtt } = await supabase.from("attendance").select("user_id, status").eq("date", today);

  const attMap = (todayAtt ?? []).reduce((acc: Record<string, string>, a) => { acc[a.user_id] = a.status; return acc; }, {});
  const dateDisplay = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const stats = {
    present: (todayAtt ?? []).filter(a => a.status === "PRESENT").length,
    wfh: (todayAtt ?? []).filter(a => a.status === "WFH").length,
    leave: (todayAtt ?? []).filter(a => a.status === "LEAVE").length,
    unmarked: (employees ?? []).filter(e => !attMap[e.id]).length,
  };

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <div>
        <div className="font-mono" style={{ fontSize: ".78rem", color: "var(--text-muted)", marginBottom: ".35rem" }}>{dateDisplay}</div>
        <h1 className="font-title" style={{ fontSize: "2rem", fontWeight: 800 }}>Team Dashboard</h1>
        <p style={{ color: "var(--text-muted)", fontSize: ".9rem", marginTop: ".25rem" }}>Today&apos;s attendance at a glance</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: ".75rem" }}>
        <div className="stat-card"><div className="stat-value" style={{ color: "var(--present)" }}>{stats.present}</div><div className="stat-label">Present</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: "var(--wfh)" }}>{stats.wfh}</div><div className="stat-label">WFH</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: "var(--absent)" }}>{stats.leave}</div><div className="stat-label">Leave/Absent</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: "var(--text-muted)" }}>{stats.unmarked}</div><div className="stat-label">Unmarked</div></div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "2px solid var(--border)" }}>
          <h2 style={{ fontSize: ".95rem", fontWeight: 700 }}>All Employees ({(employees ?? []).length})</h2>
        </div>
        <div className="table-wrap table-scroll">
          <table>
            <thead><tr><th>Employee</th><th>Type</th><th>Today</th><th>Action</th></tr></thead>
            <tbody>
              {(employees ?? []).map(emp => {
                const status = attMap[emp.id];
                return (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{emp.full_name}</div>
                      <div style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>{emp.email}</div>
                    </td>
                    <td><span style={{ fontSize: ".8rem", color: "var(--text-muted)" }}>{emp.employment_type === "INTERN" ? "Intern" : "Full-time"}</span></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                        <span className={`status-dot ${status ? statusDotClass(status as any) : "dot-unmarked"}`} />
                        <span style={{ fontSize: ".85rem" }}>{status ? statusLabel(status) : <span style={{ color: "var(--text-muted)" }}>Not marked</span>}</span>
                      </div>
                    </td>
                    <td>
                      <a href={`/admin/employees/${emp.id}`} className="btn btn-ghost" style={{ fontSize: ".78rem", padding: ".3rem .7rem" }}>View &rarr;</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}