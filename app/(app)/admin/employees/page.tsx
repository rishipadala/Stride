"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { fmtDate } from "@/lib/utils";

interface Employee {
  id: string; full_name: string; email: string;
  role: string; employment_type: string | null; start_date: string | null;
}

export default function EmployeesPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Add employee form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [empType, setEmpType] = useState("FULL_TIME");
  const [startDate, setStartDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<{type:"success"|"error";text:string}|null>(null);

  async function load() {
    const { data } = await supabase.from("profiles").select("*").order("full_name");
    setEmployees(data ?? []); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { setAddMsg({ type: "error", text: "Name and email are required" }); return; }
    setAdding(true); setAddMsg(null);
    const res = await fetch("/api/admin/create-employee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: name.trim(), email: email.trim(), employment_type: empType, start_date: startDate || null }),
    });
    const json = await res.json();
    if (!res.ok) { setAddMsg({ type: "error", text: json.error ?? "Failed to create employee" }); setAdding(false); return; }
    setAddMsg({ type: "success", text: `Invite sent to ${email}! They can sign up with that email.` });
    setName(""); setEmail(""); setEmpType("FULL_TIME"); setStartDate("");
    setAdding(false); load();
  }

  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"50vh" }}><span className="spinner" style={{width:28,height:28}} /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="font-title" style={{ fontSize: "2rem", fontWeight: 700 }}>Employees</h1>
          <p style={{ color: "var(--text-muted)", fontSize: ".9rem" }}>{employees.length} team {employees.length === 1 ? "member" : "members"}</p>
        </div>
        <button id="emp-add-toggle" className="btn btn-primary" onClick={() => { setShowForm(!showForm); setAddMsg(null); }}>
          {showForm ? "Cancel" : "+ Add Employee"}
        </button>
      </div>

      {/* Add employee form */}
      {showForm && (
        <div className="card animate-in">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1.25rem" }}>Add New Employee</h2>
          <p style={{ fontSize: ".85rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
            This will pre-register the employee. They can sign up using this email address.
          </p>
          {addMsg && <div className={`alert alert-${addMsg.type}`} style={{ marginBottom: "1rem" }}>{addMsg.text}</div>}
          <form onSubmit={addEmployee} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="input-label">Full Name *</label>
                <input id="emp-name" className="input" type="text" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="input-label">Work Email *</label>
                <input id="emp-email" className="input" type="email" placeholder="jane@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="input-label">Employment Type</label>
                <select id="emp-type" className="input" value={empType} onChange={e => setEmpType(e.target.value)}>
                  <option value="FULL_TIME">Full-time</option>
                  <option value="INTERN">Intern</option>
                </select>
              </div>
              <div className="form-group">
                <label className="input-label">Start Date</label>
                <input id="emp-start" className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
            </div>
            <button id="emp-submit" className="btn btn-primary" type="submit" disabled={adding} style={{ alignSelf: "flex-start" }}>
              {adding ? <span className="spinner" /> : "Add Employee"}
            </button>
          </form>
        </div>
      )}

      {/* Employee table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Start Date</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 500 }}>{emp.full_name}</td>
                  <td><span className="font-mono" style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>{emp.email}</span></td>
                  <td><span style={{ fontSize: ".8rem" }}>{emp.employment_type === "INTERN" ? "Intern" : "Full-time"}</span></td>
                  <td><span className="font-mono" style={{ fontSize: ".78rem" }}>{emp.start_date ? fmtDate(emp.start_date) : "—"}</span></td>
                  <td><span style={{ fontSize: ".78rem", color: emp.role === "ADMIN" ? "var(--accent)" : "var(--text-muted)" }}>{emp.role}</span></td>
                  <td><Link href={`/admin/employees/${emp.id}`} className="btn btn-ghost" style={{ fontSize: ".78rem", padding: ".3rem .7rem" }}>View History →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}