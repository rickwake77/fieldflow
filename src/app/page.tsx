"use client";

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import OfflineBar from "@/components/OfflineBar";

// ============================================================
// TYPES
// ============================================================
type ViewId = "dashboard" | "jobs" | "customers" | "invoices" | "machines" | "job-detail" | "team" | "job-types";

// ============================================================
// CONTEXT
// ============================================================
interface AppState {
  users: any[];
  customers: any[];
  fields: any[];
  jobs: any[];
  jobTypes: any[];
  machines: any[];
  invoices: any[];
  currentUser: any | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppState>({
  users: [], customers: [], fields: [], jobs: [], jobTypes: [], machines: [], invoices: [],
  currentUser: null, loading: true, refresh: async () => { },
});

const useApp = () => useContext(AppContext);

// ============================================================
// HELPERS
// ============================================================
const statusColors: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-stone-100 text-stone-500 border-stone-200",
  draft: "bg-stone-100 text-stone-600 border-stone-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
};

const statusDotColors: Record<string, string> = {
  scheduled: "bg-blue-500",
  in_progress: "bg-amber-500 animate-pulse",
  completed: "bg-emerald-500",
  sent: "bg-blue-500",
  paid: "bg-emerald-500",
  overdue: "bg-red-500",
  draft: "bg-stone-400",
};

const statusLabel = (s: string) =>
  ({ scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled", draft: "Draft", sent: "Sent", paid: "Paid", overdue: "Overdue" }[s] || s);

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const fmtCurrency = (n: number) => `£${Number(n).toFixed(2)}`;

// ============================================================
// SHARED UI COMPONENTS
// ============================================================
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[status] || "bg-stone-100 text-stone-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusDotColors[status] || "bg-stone-400"}`} />
      {statusLabel(status)}
    </span>
  );
}

function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-stone-200 rounded-xl transition-all duration-150 ${onClick ? "cursor-pointer hover:border-field-300 hover:shadow-md" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex justify-between items-start mb-6 gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900 truncate" style={{ fontFamily: "Georgia, serif" }}>{title}</h1>
        {subtitle && <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  );
}

function Btn({ children, variant = "primary", className = "", ...props }: any) {
  const styles: Record<string, string> = {
    primary: "bg-field-700 text-white hover:bg-field-800 shadow-sm hover:shadow",
    secondary: "bg-field-50 text-field-700 hover:bg-field-100",
    ghost: "bg-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-700",
    danger: "bg-red-50 text-red-700 hover:bg-red-600 hover:text-white",
    accent: "bg-harvest-500 text-white hover:bg-harvest-600 shadow-sm",
  };
  return (
    <button className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-stone-500 mb-1.5">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full px-3 py-2.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:border-field-500 focus:ring-2 focus:ring-field-500/20 transition placeholder:text-stone-400";

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-6 animate-[slideUp_0.3s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold" style={{ fontFamily: "Georgia, serif" }}>{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ value, label, color = "text-stone-900" }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <div className={`text-2xl font-bold ${color}`} style={{ fontFamily: "Georgia, serif" }}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-field-200 border-t-field-600 rounded-full animate-spin" />
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ onSelectJob, onNavigate }: { onSelectJob?: (job: any) => void; onNavigate?: (view: string, filter?: string) => void }) {
  const { jobs, invoices, users, customers } = useApp();
  const active = jobs.filter((j: any) => j.status !== "completed" && j.status !== "cancelled");
  const completed = jobs.filter((j: any) => j.status === "completed");
  const totalInvoiced = invoices.reduce((s: number, i: any) => s + Number(i.total), 0);
  const unpaid = invoices.filter((i: any) => i.status !== "paid");
  const teamMembers = users.filter((u: any) => u.role === "contractor" || u.role === "job_admin");

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your contracting business" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="cursor-pointer" onClick={() => onNavigate?.("jobs", "active")}>
          <StatCard value={active.length} label="Active Jobs" color="text-field-700" />
        </div>
        <div className="cursor-pointer" onClick={() => onNavigate?.("jobs", "completed")}>
          <StatCard value={completed.length} label="Completed Jobs" color="text-emerald-600" />
        </div>
        <div className="cursor-pointer" onClick={() => onNavigate?.("invoices")}>
          <StatCard value={fmtCurrency(totalInvoiced)} label="Invoiced" color="text-harvest-600" />
        </div>
        <div className="cursor-pointer" onClick={() => onNavigate?.("invoices", "unpaid")}>
          <StatCard value={unpaid.length} label="Unpaid Invoices" color="text-red-600" />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-stone-900" style={{ fontFamily: "Georgia, serif" }}>Recent Jobs</h3>
            <button onClick={() => onNavigate?.("jobs")} className="text-xs font-semibold text-field-700 hover:underline">View all</button>
          </div>
          <div className="space-y-1">
            {jobs.slice(0, 6).map((job: any) => (
              <div key={job.id} onClick={() => onSelectJob?.(job)} className="flex justify-between items-center gap-3 py-2.5 border-b border-stone-100 last:border-0 cursor-pointer hover:bg-stone-50 -mx-2 px-2 rounded-lg transition">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{job.title}</div>
                  <div className="text-xs text-stone-500 truncate">{job.customer?.name} · {fmtDate(job.plannedDate)}</div>
                </div>
                <div className="flex-shrink-0"><StatusBadge status={job.status} /></div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-stone-900" style={{ fontFamily: "Georgia, serif" }}>Team</h3>
            <button onClick={() => onNavigate?.("team")} className="text-xs font-semibold text-field-700 hover:underline">Manage</button>
          </div>
          <div className="space-y-1">
            {teamMembers.map((user: any) => {
              const userJobs = jobs.filter((j: any) => j.assignedTo?.id === user.id && j.status !== "completed");
              return (
                <div key={user.id} className="flex justify-between items-center gap-3 py-2.5 border-b border-stone-100 last:border-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-field-100 flex items-center justify-center text-field-700 font-bold text-xs flex-shrink-0">
                      {user.name.split(" ").map((n: string) => n[0]).join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{user.name}</div>
                      <div className="text-xs text-stone-500">{userJobs.length} active jobs</div>
                    </div>
                  </div>
                  <div className="text-xs text-stone-400 hidden sm:block flex-shrink-0">{user.phone}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// JOBS
// ============================================================
function JobsView({ onSelectJob, initialFilter }: { onSelectJob: (job: any) => void; initialFilter?: string }) {
  const { jobs, customers, fields, jobTypes, users, machines, refresh } = useApp();
  const [filter, setFilter] = useState(initialFilter || "all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    customerId: "", fieldId: "", jobTypeId: "", assignedToUserId: "",
    title: "", description: "", plannedDate: "", estimatedQuantity: "", unitType: "",
  });

  const filtered = filter === "all" ? jobs : (filter === "active" ? jobs.filter((j: any) => j.status === "scheduled" || j.status === "in_progress") : jobs.filter((j: any) => j.status === filter));
  const assignableUsers = users.filter((u: any) => u.active);
  const customerFields = form.customerId ? fields.filter((f: any) => f.customer?.id === Number(form.customerId)) : [];

  // Auto-set unit type when job type selected
  const handleJobTypeChange = (jobTypeId: string) => {
    const jt = jobTypes.find((j: any) => j.id === Number(jobTypeId));
    setForm(f => ({ ...f, jobTypeId, unitType: jt?.billingUnit || "" }));
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.createJob({
        customerId: Number(form.customerId),
        fieldId: form.fieldId ? Number(form.fieldId) : undefined,
        jobTypeId: Number(form.jobTypeId),
        assignedToUserId: form.assignedToUserId ? Number(form.assignedToUserId) : undefined,
        title: form.title,
        description: form.description || undefined,
        plannedDate: form.plannedDate || undefined,
        estimatedQuantity: form.estimatedQuantity ? Number(form.estimatedQuantity) : undefined,
        unitType: form.unitType || undefined,
      });
      await refresh();
      setShowCreate(false);
      setForm({ customerId: "", fieldId: "", jobTypeId: "", assignedToUserId: "", title: "", description: "", plannedDate: "", estimatedQuantity: "", unitType: "" });
    } catch (err: any) {
      alert("Error creating job: " + err.message);
    }
    setCreating(false);
  };

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle={`${jobs.length} total jobs`}
        action={<Btn onClick={() => setShowCreate(true)}>+ New Job</Btn>}
      />

      <div className="flex gap-1.5 mb-5 flex-wrap">
        {["all", "active", "scheduled", "in_progress", "completed"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${filter === f ? "bg-field-100 text-field-700" : "text-stone-500 hover:bg-stone-100"}`}>
            {f === "all" ? "All" : f === "active" ? "Active" : statusLabel(f)}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <Card className="overflow-hidden hidden lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-stone-200">
              {["Job", "Customer", "Field", "Type", "Assigned To", "Date", "Est. Qty", "Status"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((job: any) => (
              <tr key={job.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer transition" onClick={() => onSelectJob(job)}>
                <td className="px-4 py-3 font-semibold text-sm">{job.title}</td>
                <td className="px-4 py-3 text-sm">{job.customer?.name}</td>
                <td className="px-4 py-3 text-sm">{job.field?.fieldName || "—"}</td>
                <td className="px-4 py-3 text-sm">{job.jobType?.name}</td>
                <td className="px-4 py-3 text-sm">{job.assignedTo?.name || "—"}</td>
                <td className="px-4 py-3 text-sm">{fmtDate(job.plannedDate)}</td>
                <td className="px-4 py-3 text-sm font-mono">{job.estimatedQuantity ? `${Number(job.estimatedQuantity)} ${job.unitType || "units"}` : "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-stone-400 text-sm">No jobs found</div>}
      </Card>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-2.5">
        {filtered.map((job: any) => (
          <Card key={job.id} className="p-4" onClick={() => onSelectJob(job)}>
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="font-bold text-sm min-w-0 flex-1 truncate">{job.title}</div>
              <div className="flex-shrink-0"><StatusBadge status={job.status} /></div>
            </div>
            <div className="text-xs text-stone-500 space-y-0.5">
              <div className="truncate">{job.customer?.name}{job.field?.fieldName ? ` · ${job.field.fieldName}` : ""}</div>
              <div>{fmtDate(job.plannedDate)} · {job.estimatedQuantity ? `${Number(job.estimatedQuantity)} ${job.unitType || "units"}` : ""}</div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <div className="text-center py-12 text-stone-400 text-sm">No jobs found</div>}
      </div>

      {/* Create Job Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Job">
        <FormField label="Customer" required>
          <select className={inputClass} value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value, fieldId: "" }))}>
            <option value="">Select customer...</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField label="Job Type" required>
          <select className={inputClass} value={form.jobTypeId} onChange={e => handleJobTypeChange(e.target.value)}>
            <option value="">Select type...</option>
            {jobTypes.map((jt: any) => <option key={jt.id} value={jt.id}>{jt.name}</option>)}
          </select>
        </FormField>
        <FormField label="Field">
          <select className={inputClass} value={form.fieldId} onChange={e => setForm(f => ({ ...f, fieldId: e.target.value }))} disabled={!form.customerId}>
            <option value="">{form.customerId ? "None / not applicable" : "Select customer first"}</option>
            {customerFields.map((f: any) => <option key={f.id} value={f.id}>{f.fieldName} ({Number(f.hectares)} ac)</option>)}
          </select>
        </FormField>
        <FormField label="Assign To">
          <select className={inputClass} value={form.assignedToUserId} onChange={e => setForm(f => ({ ...f, assignedToUserId: e.target.value }))}>
            <option value="">Unassigned</option>
            {assignableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </FormField>
        <FormField label="Title" required>
          <input className={inputClass} placeholder="e.g. Plough Top Field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Planned Date">
            <input className={inputClass} type="date" value={form.plannedDate} onChange={e => setForm(f => ({ ...f, plannedDate: e.target.value }))} />
          </FormField>
          <FormField label={`Estimated Qty${form.unitType ? ` (${form.unitType}s)` : ""}`}>
            <input className={inputClass} type="number" step="0.25" placeholder="0" value={form.estimatedQuantity} onChange={e => setForm(f => ({ ...f, estimatedQuantity: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Description">
          <textarea className={inputClass} placeholder="Additional notes..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </FormField>
        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleCreate} disabled={creating || !form.customerId || !form.jobTypeId || !form.title}>
            {creating ? "Creating..." : "Create Job"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// JOB DETAIL
// ============================================================
function JobDetail({ jobId, onBack }: { jobId: number; onBack: () => void }) {
  const { machines, users, refresh } = useApp();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logSaving, setLogSaving] = useState(false);
  const [logForm, setLogForm] = useState({ machineId: "", quantityCompleted: "", notes: "" });
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ assignedToUserId: "", plannedDate: "", title: "", description: "", estimatedQuantity: "" });

  const loadJob = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getJob(jobId);
      setJob(data);
    } catch (err: any) {
      alert("Error loading job: " + err.message);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => { loadJob(); }, [loadJob]);

  if (loading || !job) return <Spinner />;

  const logs = job.jobLogs || [];
  const totalQty = logs.reduce((s: number, l: any) => s + Number(l.quantityCompleted), 0);
  const estQty = Number(job.estimatedQuantity || 0);
  const progress = estQty > 0 ? Math.min(100, Math.round((totalQty / estQty) * 100)) : 0;
  const assignableUsers = users.filter((u: any) => u.active);

  const openEdit = () => {
    setEditForm({
      assignedToUserId: job.assignedTo?.id ? String(job.assignedTo.id) : "",
      plannedDate: job.plannedDate ? new Date(job.plannedDate).toISOString().split("T")[0] : "",
      title: job.title || "",
      description: job.description || "",
      estimatedQuantity: job.estimatedQuantity ? String(Number(job.estimatedQuantity)) : "",
    });
    setShowEditForm(true);
  };

  const handleEditSave = async () => {
    setEditSaving(true);
    try {
      await api.updateJob(job.id, {
        assignedToUserId: editForm.assignedToUserId ? Number(editForm.assignedToUserId) : null,
        plannedDate: editForm.plannedDate || undefined,
        title: editForm.title,
        description: editForm.description || undefined,
        estimatedQuantity: editForm.estimatedQuantity ? Number(editForm.estimatedQuantity) : undefined,
      });
      await loadJob();
      await refresh();
      setShowEditForm(false);
    } catch (err: any) {
      alert("Error updating job: " + err.message);
    }
    setEditSaving(false);
  };

  const handleLogWork = async () => {
    setLogSaving(true);
    try {
      const result = await api.createJobLog({
        jobId: job.id,
        contractorId: job.assignedTo?.id || assignableUsers[0]?.id,
        machineId: logForm.machineId ? Number(logForm.machineId) : undefined,
        quantityCompleted: Number(logForm.quantityCompleted),
        hoursWorked: 0,
        notes: logForm.notes || undefined,
      });
      if ((result as any)?.queued) {
        // Queued for later sync — close form and show confirmation
        setShowLogForm(false);
        setLogForm({ machineId: "", quantityCompleted: "", notes: "" });
      } else {
        await loadJob();
        await refresh();
        setShowLogForm(false);
        setLogForm({ machineId: "", quantityCompleted: "", notes: "" });
      }
    } catch (err: any) {
      alert("Error logging work: " + err.message);
    }
    setLogSaving(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusUpdating(true);
    try {
      await api.updateJob(job.id, { status: newStatus });
      await loadJob();
      await refresh();
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
    setStatusUpdating(false);
  };

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition mb-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Back to jobs
      </button>

      <Card className="p-5 mb-4">
        <div className="flex justify-between items-start gap-2 mb-4">
          <h2 className="text-xl font-bold min-w-0 flex-1 truncate" style={{ fontFamily: "Georgia, serif" }}>{job.title}</h2>
          <div className="flex gap-2 flex-shrink-0">
            <Btn variant="secondary" onClick={openEdit}>Edit</Btn>
            <StatusBadge status={job.status} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div><span className="text-stone-500">Customer:</span> <span className="font-medium">{job.customer?.name}</span></div>
          <div><span className="text-stone-500">Field:</span> <span className="font-medium">{job.field ? `${job.field.fieldName} (${Number(job.field.hectares)} ac)` : "—"}</span></div>
          <div><span className="text-stone-500">Type:</span> <span className="font-medium">{job.jobType?.name}</span></div>
          <div><span className="text-stone-500">Assigned:</span> <span className="font-medium">{job.assignedTo?.name || "Unassigned"}</span></div>
          <div><span className="text-stone-500">Date:</span> <span className="font-medium">{fmtDate(job.plannedDate)}</span></div>
          <div><span className="text-stone-500">Estimated:</span> <span className="font-medium">{estQty ? `${estQty} ${job.unitType || "units"}` : "—"}</span></div>
        </div>
        {job.description && <p className="mt-3 text-sm text-stone-500 italic">{job.description}</p>}

        {/* Status actions */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-stone-100">
          {job.status === "scheduled" && (
            <Btn variant="accent" onClick={() => handleStatusChange("in_progress")} disabled={statusUpdating}>
              Mark In Progress
            </Btn>
          )}
          {job.status === "in_progress" && (
            <Btn onClick={() => handleStatusChange("completed")} disabled={statusUpdating}>
              Mark Completed
            </Btn>
          )}
          {job.status === "completed" && (
            <Btn variant="secondary" onClick={() => handleStatusChange("in_progress")} disabled={statusUpdating}>
              Reopen Job
            </Btn>
          )}
          <Btn variant="danger" onClick={async () => {
            if (!confirm(`Delete "${job.title}"? This will also delete all work logs for this job.`)) return;
            try { await api.deleteJob(job.id); await refresh(); onBack(); } catch (err: any) { alert("Error: " + err.message); }
          }}>
            Delete Job
          </Btn>
        </div>
      </Card>

      {/* Progress */}
      <Card className="p-5 mb-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-3">Progress</div>
        <div className="flex gap-8 mb-3">
          <div>
            <span className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif" }}>{totalQty}</span>
            <span className="text-sm text-stone-500">{estQty ? ` / ${estQty}` : ""} {job.unitType || "units"} completed</span>
          </div>
        </div>
        {estQty > 0 && (
          <>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? "bg-emerald-500" : "bg-field-600"}`} style={{ width: `${progress}%` }} />
            </div>
            <div className="text-right text-xs text-stone-400 mt-1">{progress}% complete</div>
          </>
        )}
      </Card>

      {/* Log Work button */}
      {job.status !== "completed" && job.status !== "cancelled" && (
        <Btn className="w-full mb-5 py-3" onClick={() => setShowLogForm(true)}>+ Log Work</Btn>
      )}

      {/* Work Logs */}
      {logs.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">Work Logs</div>
          <div className="space-y-2">
            {logs.map((log: any) => (
              <Card key={log.id} className="p-4">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{log.machine?.name || "No machine"}</span>
                  <span className="text-stone-400">{fmtDate(log.createdAt)}</span>
                </div>
                <div className="text-sm text-stone-500 mt-1">
                  {Number(log.quantityCompleted)} {job.unitType || "units"}
                  {log.contractor && <span> · {log.contractor.name}</span>}
                </div>
                {log.notes && <p className="text-sm text-stone-500 mt-2 italic">{log.notes}</p>}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Log Work Modal */}
      <Modal isOpen={showLogForm} onClose={() => setShowLogForm(false)} title="Log Work">
        <FormField label="Machine">
          <select className={inputClass} value={logForm.machineId} onChange={e => setLogForm(f => ({ ...f, machineId: e.target.value }))}>
            <option value="">Select machine...</option>
            {machines.filter((m: any) => m.active).map((m: any) => (
              <option key={m.id} value={m.id}>{m.name} ({m.registration})</option>
            ))}
          </select>
        </FormField>
        <FormField label={`Qty (${job.unitType || "units"})`} required>
          <input className={inputClass} type="number" step="0.1" placeholder="0" value={logForm.quantityCompleted} onChange={e => setLogForm(f => ({ ...f, quantityCompleted: e.target.value }))} />
        </FormField>
        <FormField label="Notes">
          <textarea className={inputClass} placeholder="Conditions, issues, anything to note..." rows={3} value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} />
        </FormField>
        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowLogForm(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleLogWork} disabled={logSaving || !logForm.quantityCompleted}>
            {logSaving ? "Saving..." : "Save Log"}
          </Btn>
        </div>
      </Modal>

      {/* Edit Job Modal */}
      <Modal isOpen={showEditForm} onClose={() => setShowEditForm(false)} title="Edit Job">
        <FormField label="Title" required>
          <input className={inputClass} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
        </FormField>
        <FormField label="Assigned To">
          <select className={inputClass} value={editForm.assignedToUserId} onChange={e => setEditForm(f => ({ ...f, assignedToUserId: e.target.value }))}>
            <option value="">Unassigned</option>
            {assignableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Planned Date">
            <input className={inputClass} type="date" value={editForm.plannedDate} onChange={e => setEditForm(f => ({ ...f, plannedDate: e.target.value }))} />
          </FormField>
          <FormField label={`Estimated Qty${job.unitType ? ` (${job.unitType}s)` : ""}`}>
            <input className={inputClass} type="number" step="0.25" value={editForm.estimatedQuantity} onChange={e => setEditForm(f => ({ ...f, estimatedQuantity: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Description">
          <textarea className={inputClass} rows={3} placeholder="Notes, instructions..." value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
        </FormField>
        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowEditForm(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleEditSave} disabled={editSaving || !editForm.title}>
            {editSaving ? "Saving..." : "Save Changes"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// CUSTOMERS
// ============================================================
function CustomersView() {
  const { customers, fields, refresh } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", phone: "", email: "", address: "" });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [fieldForm, setFieldForm] = useState({ customerId: 0, fieldName: "", hectares: "", notes: "" });
  const [fieldSaving, setFieldSaving] = useState(false);

  const openCreate = () => {
    setForm({ name: "", contact: "", phone: "", email: "", address: "" });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (c: any) => {
    setForm({ name: c.name, contact: c.contact || "", phone: c.phone || "", email: c.email || "", address: c.address || "" });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await api.updateCustomer(editingId, form);
      } else {
        await api.createCustomer(form);
      }
      await refresh();
      setShowForm(false);
    } catch (err: any) { alert("Error: " + err.message); }
    setSaving(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}" and all their fields? This cannot be undone.`)) return;
    try {
      await api.deleteCustomer(id);
      await refresh();
    } catch (err: any) { alert("Error: " + err.message); }
  };

  const openAddField = (customerId: number) => {
    setFieldForm({ customerId, fieldName: "", hectares: "", notes: "" });
    setShowFieldForm(true);
  };

  const handleSaveField = async () => {
    setFieldSaving(true);
    try {
      await api.createField({
        customerId: fieldForm.customerId,
        fieldName: fieldForm.fieldName,
        hectares: Number(fieldForm.hectares) || 0,
        notes: fieldForm.notes || undefined,
      });
      await refresh();
      setShowFieldForm(false);
    } catch (err: any) { alert("Error: " + err.message); }
    setFieldSaving(false);
  };

  const handleDeleteField = async (id: number, name: string) => {
    if (!confirm(`Delete field "${name}"?`)) return;
    try {
      await api.deleteField(id);
      await refresh();
    } catch (err: any) { alert("Error: " + err.message); }
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customers`}
        action={<Btn onClick={openCreate}>+ Add Customer</Btn>}
      />

      {/* Desktop table */}
      <Card className="overflow-hidden hidden lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-stone-200">
              {["Name", "Contact", "Phone", "Email", "Fields", "Acres", "Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c: any) => {
              const custFields = (c.fields || []);
              const totalHa = custFields.reduce((s: number, f: any) => s + Number(f.hectares), 0);
              const isExpanded = expandedId === c.id;
              return (
                <>
                  <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50 transition cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                    <td className="px-4 py-3 font-semibold text-sm">{c.name}</td>
                    <td className="px-4 py-3 text-sm">{c.contact || "—"}</td>
                    <td className="px-4 py-3 text-sm">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-sm text-field-700">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-sm">{custFields.length}</td>
                    <td className="px-4 py-3 text-sm font-mono">{totalHa}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(c)} className="px-2 py-1 text-xs font-medium text-field-700 bg-field-50 rounded hover:bg-field-100 transition">Edit</button>
                        <button onClick={() => handleDelete(c.id, c.name)} className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition">Delete</button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${c.id}-fields`}>
                      <td colSpan={7} className="px-4 py-3 bg-stone-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Fields</span>
                          <button onClick={() => openAddField(c.id)} className="text-xs font-semibold text-field-700 hover:underline">+ Add Field</button>
                        </div>
                        {custFields.length > 0 ? (
                          <div className="space-y-1.5">
                            {custFields.map((f: any) => (
                              <div key={f.id} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 border border-stone-200">
                                <div>
                                  <span className="text-sm font-medium">{f.fieldName}</span>
                                  <span className="text-xs text-stone-500 ml-2">{Number(f.hectares)} ac</span>
                                </div>
                                <button onClick={() => handleDeleteField(f.id, f.fieldName)} className="text-xs text-red-500 hover:underline">Remove</button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-stone-400">No fields yet</div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-2.5">
        {customers.map((c: any) => {
          const custFields = (c.fields || []);
          const totalHa = custFields.reduce((s: number, f: any) => s + Number(f.hectares), 0);
          const isExpanded = expandedId === c.id;
          return (
            <Card key={c.id} className="p-4">
              <div className="flex justify-between items-start gap-2" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm truncate">{c.name}</div>
                  <div className="text-xs text-stone-500 mt-0.5 truncate">
                    {c.contact && <span>{c.contact} · </span>}{c.phone}
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">{custFields.length} fields · {totalHa} ac</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="px-2 py-1 text-xs font-medium text-field-700 bg-field-50 rounded hover:bg-field-100 transition">Edit</button>
                </div>
              </div>
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Fields</span>
                    <button onClick={() => openAddField(c.id)} className="text-xs font-semibold text-field-700">+ Add</button>
                  </div>
                  {custFields.map((f: any) => (
                    <div key={f.id} className="flex justify-between items-center py-1.5">
                      <div className="text-sm">{f.fieldName} <span className="text-stone-400 text-xs">{Number(f.hectares)} ac</span></div>
                      <button onClick={() => handleDeleteField(f.id, f.fieldName)} className="text-xs text-red-500">Remove</button>
                    </div>
                  ))}
                  {custFields.length === 0 && <div className="text-xs text-stone-400">No fields</div>}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Customer Form Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Customer" : "Add Customer"}>
        <FormField label="Business Name" required>
          <input className={inputClass} placeholder="e.g. Greenfield Estates" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Contact Person">
          <input className={inputClass} placeholder="e.g. Robert Green" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Phone">
            <input className={inputClass} placeholder="01234 567890" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </FormField>
          <FormField label="Email">
            <input className={inputClass} placeholder="email@example.co.uk" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Address">
          <textarea className={inputClass} placeholder="Full address..." rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </FormField>
        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? "Saving..." : editingId ? "Save Changes" : "Add Customer"}
          </Btn>
        </div>
      </Modal>

      {/* Add Field Modal */}
      <Modal isOpen={showFieldForm} onClose={() => setShowFieldForm(false)} title="Add Field">
        <FormField label="Field Name" required>
          <input className={inputClass} placeholder="e.g. Top Field" value={fieldForm.fieldName} onChange={e => setFieldForm(f => ({ ...f, fieldName: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Acres">
            <input className={inputClass} type="number" step="0.1" placeholder="0" value={fieldForm.hectares} onChange={e => setFieldForm(f => ({ ...f, hectares: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Notes">
          <textarea className={inputClass} placeholder="Access info, soil type, hazards..." rows={2} value={fieldForm.notes} onChange={e => setFieldForm(f => ({ ...f, notes: e.target.value }))} />
        </FormField>
        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowFieldForm(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleSaveField} disabled={fieldSaving || !fieldForm.fieldName}>
            {fieldSaving ? "Saving..." : "Add Field"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// INVOICES
// ============================================================
function InvoicesView({ initialFilter }: { initialFilter?: string }) {
  const { invoices, customers, jobs, refresh } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [filter, setFilter] = useState(initialFilter || "all");

  const filteredInvoices = filter === "all" ? invoices : (filter === "unpaid" ? invoices.filter((i: any) => i.status !== "paid") : invoices.filter((i: any) => i.status === filter));

  const completedJobs = selectedCustomer
    ? jobs.filter((j: any) => j.customer?.id === Number(selectedCustomer) && j.status === "completed")
    : [];

  const toggleJob = (id: number) => {
    setSelectedJobIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.createInvoice({
        customerId: Number(selectedCustomer),
        jobIds: selectedJobIds,
      });
      await refresh();
      setShowCreate(false);
      setSelectedCustomer("");
      setSelectedJobIds([]);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setCreating(false);
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await api.updateInvoice(id, { status });
      await refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} invoices`}
        action={<Btn onClick={() => setShowCreate(true)}>+ Generate Invoice</Btn>}
      />

      <div className="flex gap-1.5 mb-5 flex-wrap">
        {["all", "unpaid", "draft", "sent", "paid"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${filter === f ? "bg-field-100 text-field-700" : "text-stone-500 hover:bg-stone-100"}`}>
            {f === "all" ? "All" : f === "unpaid" ? "Unpaid" : statusLabel(f)}
          </button>
        ))}
      </div>

      {filteredInvoices.length > 0 ? (
        <>
          {/* Desktop table */}
          <Card className="overflow-hidden hidden lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-stone-200">
                  {["Invoice #", "Customer", "Date", "Due", "Subtotal", "VAT", "Total", "Status", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition">
                    <td className="px-4 py-3 font-semibold text-sm font-mono">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm">{inv.customer?.name}</td>
                    <td className="px-4 py-3 text-sm">{fmtDate(inv.invoiceDate)}</td>
                    <td className="px-4 py-3 text-sm">{fmtDate(inv.dueDate)}</td>
                    <td className="px-4 py-3 text-sm font-mono">{fmtCurrency(Number(inv.subtotal))}</td>
                    <td className="px-4 py-3 text-sm font-mono">{fmtCurrency(Number(inv.vat))}</td>
                    <td className="px-4 py-3 text-sm font-mono font-semibold">{fmtCurrency(Number(inv.total))}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {inv.status === "draft" && (
                          <button onClick={() => handleStatusUpdate(inv.id, "sent")} className="text-xs text-blue-600 hover:underline">Send</button>
                        )}
                        {inv.status === "sent" && (
                          <button onClick={() => handleStatusUpdate(inv.id, "paid")} className="text-xs text-emerald-600 hover:underline">Mark Paid</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-2.5">
            {filteredInvoices.map((inv: any) => (
              <Card key={inv.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-mono font-bold text-sm">{inv.invoiceNumber}</div>
                    <div className="text-xs text-stone-500">{inv.customer?.name}</div>
                  </div>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="text-xs text-stone-400">Due {fmtDate(inv.dueDate)}</div>
                  <div className="font-bold font-mono">{fmtCurrency(Number(inv.total))}</div>
                </div>
                <div className="flex gap-2 mt-3 pt-2 border-t border-stone-100">
                  {inv.status === "draft" && <button onClick={() => handleStatusUpdate(inv.id, "sent")} className="text-xs text-blue-600 font-semibold">Mark Sent</button>}
                  {inv.status === "sent" && <button onClick={() => handleStatusUpdate(inv.id, "paid")} className="text-xs text-emerald-600 font-semibold">Mark Paid</button>}
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className="p-12 text-center">
          <div className="text-stone-400 text-sm">No invoices yet. Generate one from completed jobs.</div>
        </Card>
      )}

      {/* Generate Invoice Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Generate Invoice">
        <FormField label="Customer" required>
          <select className={inputClass} value={selectedCustomer} onChange={e => { setSelectedCustomer(e.target.value); setSelectedJobIds([]); }}>
            <option value="">Select customer...</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>

        {selectedCustomer && (
          <FormField label="Select Completed Jobs">
            {completedJobs.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {completedJobs.map((job: any) => (
                  <label key={job.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${selectedJobIds.includes(job.id) ? "border-field-400 bg-field-50" : "border-stone-200 hover:bg-stone-50"}`}>
                    <input type="checkbox" checked={selectedJobIds.includes(job.id)} onChange={() => toggleJob(job.id)} className="accent-field-600" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{job.title}</div>
                      <div className="text-xs text-stone-500">{job.field?.fieldName ? `${job.field.fieldName} · ` : ""}{job.jobType?.name}</div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-sm text-stone-400 py-4 text-center">No completed jobs for this customer</div>
            )}
          </FormField>
        )}

        <div className="flex gap-2 mt-4">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleCreate} disabled={creating || !selectedCustomer || selectedJobIds.length === 0}>
            {creating ? "Generating..." : `Generate Invoice (${selectedJobIds.length} jobs)`}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// MACHINES
// ============================================================
// ============================================================
// JOB TYPES
// ============================================================
function JobTypesView() {
  const { jobTypes, refresh, currentUser } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", billingUnit: "acre", defaultRate: "", description: "", vatApplicable: true });

  const billingUnits = ["acre", "hectare", "hour", "item", "job", "tonne"];

  const openEdit = (jt: any) => {
    setForm({ name: jt.name, billingUnit: jt.billingUnit, defaultRate: String(Number(jt.defaultRate)), description: jt.description || "", vatApplicable: jt.vatApplicable !== false });
    setEditingId(jt.id);
    setShowCreate(true);
  };

  const openCreate = () => {
    setForm({ name: "", billingUnit: "acre", defaultRate: "", description: "", vatApplicable: true });
    setEditingId(null);
    setShowCreate(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await api.updateJobType(editingId, {
          name: form.name,
          billingUnit: form.billingUnit,
          defaultRate: Number(form.defaultRate),
          vatApplicable: form.vatApplicable,
          description: form.description || undefined,
        });
      } else {
        await api.createJobType({
          organisationId: (currentUser as any)?.organisationId || 1,
          name: form.name,
          billingUnit: form.billingUnit,
          defaultRate: Number(form.defaultRate),
          vatApplicable: form.vatApplicable,
          description: form.description || undefined,
        });
      }
      await refresh();
      setShowCreate(false);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteJobType(id);
      await refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Job Types"
        subtitle={`${jobTypes.length} types configured`}
        action={<Btn onClick={openCreate}>+ Add Type</Btn>}
      />

      <div className="space-y-2.5">
        {jobTypes.map((jt: any) => (
          <Card key={jt.id} className="p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm">{jt.name}</div>
                <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-2">
                  <span>{fmtCurrency(Number(jt.defaultRate))} per {jt.billingUnit}</span>
                  {jt._count?.jobs > 0 && <span>· {jt._count.jobs} jobs</span>}
                  {jt.vatApplicable === false && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">No VAT</span>}
                </div>
                {jt.description && <div className="text-xs text-stone-400 mt-1">{jt.description}</div>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => openEdit(jt)} className="px-2.5 py-1.5 text-xs font-medium text-field-700 bg-field-50 rounded-lg hover:bg-field-100 transition">Edit</button>
                <button onClick={() => handleDelete(jt.id, jt.name)} className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Delete</button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={editingId ? "Edit Job Type" : "Add Job Type"}>
        <FormField label="Name" required>
          <input className={inputClass} placeholder="e.g. Ploughing" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Billing Unit" required>
            <select className={inputClass} value={form.billingUnit} onChange={e => setForm(f => ({ ...f, billingUnit: e.target.value }))}>
              {billingUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </FormField>
          <FormField label="Default Rate (£)" required>
            <input className={inputClass} type="number" step="0.01" placeholder="85.00" value={form.defaultRate} onChange={e => setForm(f => ({ ...f, defaultRate: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Description">
          <textarea className={inputClass} placeholder="Optional description..." rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </FormField>
        <label className="flex items-center gap-2.5 cursor-pointer select-none mt-1">
          <input type="checkbox" className="accent-field-600 w-4 h-4" checked={form.vatApplicable} onChange={e => setForm(f => ({ ...f, vatApplicable: e.target.checked }))} />
          <span className="text-sm text-stone-700">VAT applicable (20%)</span>
        </label>
        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleSave} disabled={saving || !form.name || !form.defaultRate}>
            {saving ? "Saving..." : editingId ? "Save Changes" : "Add Job Type"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// MACHINES
// ============================================================
function MachinesView() {
  const { machines, refresh, currentUser } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", machineType: "", registration: "" });

  const machineTypes = ["Tractor", "Combine", "Drill", "Sprayer", "Plough", "Baler", "Trailer", "Hedge Cutter", "Roller", "Subsoiler", "Muck Spreader", "Other"];

  const openEdit = (m: any) => {
    setForm({ name: m.name, machineType: m.machineType, registration: m.registration || "" });
    setEditingId(m.id);
    setShowCreate(true);
  };

  const openCreate = () => {
    setForm({ name: "", machineType: "", registration: "" });
    setEditingId(null);
    setShowCreate(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await api.updateMachine(editingId, form);
      } else {
        await api.createMachine({
          organisationId: (currentUser as any)?.organisationId || 1,
          ...form,
        });
      }
      await refresh();
      setShowCreate(false);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setSaving(false);
  };

  const handleToggleActive = async (m: any) => {
    try {
      await api.updateMachine(m.id, { active: !m.active });
      await refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteMachine(id);
      await refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Machines"
        subtitle={`${machines.length} machines`}
        action={<Btn onClick={openCreate}>+ Add Machine</Btn>}
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {machines.map((m: any) => (
          <Card key={m.id} className="p-5">
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="font-bold text-sm min-w-0 flex-1 truncate">{m.name}</div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${m.active ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-500"}`}>
                {m.active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="text-xs text-stone-500">{m.machineType}</div>
            <div className="text-xs text-stone-400 font-mono mt-0.5">{m.registration || "N/A"}</div>
            {m._count?.jobLogs > 0 && <div className="text-xs text-stone-400 mt-2">{m._count.jobLogs} work logs</div>}
            <div className="flex gap-1.5 mt-3 pt-3 border-t border-stone-100">
              <button onClick={() => openEdit(m)} className="px-2.5 py-1.5 text-xs font-medium text-field-700 bg-field-50 rounded-lg hover:bg-field-100 transition">Edit</button>
              <button onClick={() => handleToggleActive(m)} className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${m.active ? "text-amber-700 bg-amber-50 hover:bg-amber-100" : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"}`}>
                {m.active ? "Deactivate" : "Activate"}
              </button>
              <button onClick={() => handleDelete(m.id, m.name)} className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Delete</button>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={editingId ? "Edit Machine" : "Add Machine"}>
        <FormField label="Name" required>
          <input className={inputClass} placeholder="e.g. John Deere 6250R" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Type" required>
            <select className={inputClass} value={form.machineType} onChange={e => setForm(f => ({ ...f, machineType: e.target.value }))}>
              <option value="">Select type...</option>
              {machineTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
          <FormField label="Registration">
            <input className={inputClass} placeholder="e.g. WX21 FRM" value={form.registration} onChange={e => setForm(f => ({ ...f, registration: e.target.value }))} />
          </FormField>
        </div>
        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleSave} disabled={saving || !form.name || !form.machineType}>
            {saving ? "Saving..." : editingId ? "Save Changes" : "Add Machine"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// TEAM MANAGEMENT (Admin only)
// ============================================================
function TeamView() {
  const { users, refresh } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", email: "", phone: "", password: "", role: "contractor" as string });
  const [error, setError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", username: "", email: "", phone: "", role: "", password: "", active: true });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const roleLabel = (r: string) => ({ admin: "Admin", job_admin: "Job Admin", contractor: "Contractor" }[r] || r);
  const roleBadgeStyle = (r: string) => ({
    admin: "bg-harvest-50 text-harvest-700",
    job_admin: "bg-blue-50 text-blue-700",
    contractor: "bg-field-50 text-field-700",
  }[r] || "bg-stone-100 text-stone-600");

  const admins = users.filter((u: any) => u.role === "admin");
  const jobAdmins = users.filter((u: any) => u.role === "job_admin");
  const contractors = users.filter((u: any) => u.role === "contractor");

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/auth/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to create user");
      } else {
        await refresh();
        setShowCreate(false);
        setForm({ name: "", username: "", email: "", phone: "", password: "", role: "contractor" });
      }
    } catch {
      setError("Network error");
    }
    setCreating(false);
  };

  const openEdit = (u: any) => {
    setEditingUser(u);
    setEditForm({ name: u.name, username: u.username || "", email: u.email || "", phone: u.phone || "", role: u.role, password: "", active: u.active });
    setEditError("");
    setShowEdit(true);
  };

  const handleEditSave = async () => {
    setEditSaving(true);
    setEditError("");
    try {
      const payload: any = {
        name: editForm.name,
        username: editForm.username || null,
        email: editForm.email || null,
        phone: editForm.phone,
        role: editForm.role,
        active: editForm.active,
      };
      if (editForm.password) payload.password = editForm.password;

      await api.updateUser(editingUser.id, payload);
      await refresh();
      setShowEdit(false);
    } catch (err: any) {
      setEditError(err.message || "Failed to update user");
    }
    setEditSaving(false);
  };

  const renderUserCard = (u: any) => (
    <Card key={u.id} className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${u.role === "admin" ? "bg-harvest-100 text-harvest-700" : u.role === "job_admin" ? "bg-blue-100 text-blue-700" : "bg-field-100 text-field-700"}`}>
          {u.name.split(" ").map((n: string) => n[0]).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{u.name}</div>
          <div className="text-xs text-stone-500 truncate">{u.username ? `@${u.username}` : ""}{u.username && u.email ? " · " : ""}{u.email || ""}{u.phone ? ` · ${u.phone}` : ""}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!u.active && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">Inactive</span>}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${roleBadgeStyle(u.role)}`}>{roleLabel(u.role)}</span>
          <button onClick={() => openEdit(u)} className="px-2.5 py-1.5 text-xs font-medium text-field-700 bg-field-50 rounded-lg hover:bg-field-100 transition">Edit</button>
        </div>
      </div>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle={`${users.length} team members`}
        action={<Btn onClick={() => setShowCreate(true)}>+ Add User</Btn>}
      />

      {admins.length > 0 && (
        <div className="mb-6">
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">Administrators</div>
          <div className="space-y-2">{admins.map(renderUserCard)}</div>
        </div>
      )}

      {jobAdmins.length > 0 && (
        <div className="mb-6">
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">Job Administrators</div>
          <div className="space-y-2">{jobAdmins.map(renderUserCard)}</div>
        </div>
      )}

      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">Contractors</div>
        <div className="space-y-2">
          {contractors.map(renderUserCard)}
          {contractors.length === 0 && (
            <Card className="p-8 text-center">
              <div className="text-sm text-stone-400">No contractors yet. Add your first team member.</div>
            </Card>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Team Member">
        <FormField label="Full Name" required>
          <input className={inputClass} placeholder="e.g. Jack Henderson" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Username">
            <input className={inputClass} placeholder="e.g. jackh" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </FormField>
          <FormField label="Email">
            <input className={inputClass} type="email" placeholder="jack@example.co.uk" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </FormField>
        </div>
        <p className="text-xs text-stone-400 -mt-2 mb-4">At least one of username or email is required for login</p>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Phone">
            <input className={inputClass} placeholder="07712 345678" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </FormField>
          <FormField label="Role" required>
            <select className={inputClass} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="contractor">Contractor</option>
              <option value="job_admin">Job Admin</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>
        </div>
        <FormField label="Password" required>
          <input className={inputClass} type="password" placeholder="Minimum 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </FormField>
        {error && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleCreate} disabled={creating || !form.name || (!form.username && !form.email) || !form.password}>
            {creating ? "Creating..." : "Create Account"}
          </Btn>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Edit — ${editingUser?.name || ""}`}>
        <FormField label="Full Name" required>
          <input className={inputClass} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Username">
            <input className={inputClass} placeholder="e.g. jackh" value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} />
          </FormField>
          <FormField label="Email">
            <input className={inputClass} type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
          </FormField>
        </div>
        <p className="text-xs text-stone-400 -mt-2 mb-4">At least one of username or email is required for login</p>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Phone">
            <input className={inputClass} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
          </FormField>
          <FormField label="Role">
            <select className={inputClass} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
              <option value="contractor">Contractor</option>
              <option value="job_admin">Job Admin</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>
        </div>
        <FormField label="New Password">
          <input className={inputClass} type="password" placeholder="Leave blank to keep current" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} />
        </FormField>
        <div className="flex items-center gap-3 mt-2 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={editForm.active} onChange={e => setEditForm(f => ({ ...f, active: e.target.checked }))} className="accent-field-600 w-4 h-4" />
            <span className="text-sm font-medium">Active</span>
          </label>
          {!editForm.active && <span className="text-xs text-stone-400">User won't be able to log in</span>}
        </div>
        {editError && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{editError}</div>}
        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowEdit(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleEditSave} disabled={editSaving || !editForm.name || (!editForm.username && !editForm.email)}>
            {editSaving ? "Saving..." : "Save Changes"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// SIDEBAR & NAVIGATION
// ============================================================
function Sidebar({ currentView, setView, session }: { currentView: ViewId; setView: (v: ViewId) => void; session: any }) {
  const role = session?.user?.role;
  const isAdmin = role === "admin";
  const canManageJobs = role === "admin" || role === "job_admin";
  const links: { id: ViewId; label: string; icon: string; show?: boolean }[] = [
    { id: "dashboard", label: "Dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10", show: true },
    { id: "jobs", label: "Jobs", icon: "M2 7h20v14H2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16", show: true },
    { id: "customers", label: "Customers", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75", show: canManageJobs },
    { id: "invoices", label: "Invoices", icon: "M1 4h22v16H1zM1 10h22", show: isAdmin },
    { id: "job-types", label: "Job Types", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", show: canManageJobs },
    { id: "machines", label: "Machines", icon: "M7 17a3 3 0 100-6 3 3 0 000 6zM19 17a2 2 0 100-4 2 2 0 000 4zM5 17H3V9l4-4h6l3 4h5v8h-2", show: canManageJobs },
    { id: "team", label: "Team", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M20 8v6M23 11h-6", show: isAdmin },
  ];
  const visibleLinks = links.filter(l => l.show);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-field-900 text-white hidden lg:flex flex-col z-50">
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-harvest-500 flex items-center justify-center font-extrabold text-base text-white">F</div>
          <div>
            <div className="font-bold text-base" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>FieldFlow</div>
            <div className="text-[10px] text-white/40">Farm Contracting</div>
          </div>
        </div>
      </div>
      <nav className="py-3 flex-1">
        {visibleLinks.map(link => (
          <button key={link.id} onClick={() => setView(link.id)}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition ${currentView === link.id ? "text-white bg-white/10 border-r-[3px] border-harvest-400" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={link.icon} />
            </svg>
            {link.label}
          </button>
        ))}
      </nav>
      {/* User info & logout */}
      <div className="px-5 py-4 border-t border-white/10">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/70">
            {session?.user?.name?.split(" ").map((n: string) => n[0]).join("") || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white/80 truncate">{session?.user?.name}</div>
            <div className="text-[10px] text-white/40 capitalize">{session?.user?.role}</div>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition">
          Sign Out
        </button>
      </div>
    </aside>
  );
}

function MobileNav({ currentView, setView }: { currentView: ViewId; setView: (v: ViewId) => void }) {
  const tabs: { id: ViewId; label: string; icon: string }[] = [
    { id: "dashboard", label: "Home", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
    { id: "jobs", label: "Jobs", icon: "M2 7h20v14H2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" },
    { id: "customers", label: "Customers", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8" },
    { id: "invoices", label: "Invoices", icon: "M1 4h22v16H1zM1 10h22" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex lg:hidden z-50" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => setView(tab.id)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${currentView === tab.id ? "text-field-700" : "text-stone-400"}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={currentView === tab.id ? "text-field-700" : "text-stone-400"}>
            <path d={tab.icon} />
          </svg>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function FieldFlowApp() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [currentView, setCurrentView] = useState<ViewId>("dashboard");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // All data state
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobTypes, setJobTypes] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const isAdmin = (session?.user as any)?.role === "admin";
  const isJobAdmin = (session?.user as any)?.role === "job_admin";
  const canManageJobs = isAdmin || isJobAdmin; // can see all jobs, create, assign
  const currentUserId = (session?.user as any)?.id;

  const loadAll = useCallback(async () => {
    try {
      const [u, c, f, j, jt, m, i] = await Promise.all([
        api.getUsers(),
        api.getCustomers(),
        api.getFields(),
        api.getJobs(),
        api.getJobTypes(),
        api.getMachines(),
        api.getInvoices(),
      ]);
      setUsers(u);
      setCustomers(c);
      setFields(f);
      // Admin and job_admin see all jobs, contractors only their own
      setJobs(canManageJobs ? j : j.filter((job: any) => job.assignedTo?.id === currentUserId));
      setJobTypes(jt);
      setMachines(m);
      setInvoices(i);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
    setLoading(false);
  }, [canManageJobs, currentUserId]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (sessionStatus === "authenticated") loadAll();
  }, [sessionStatus, loadAll]);

  const handleSelectJob = (job: any) => {
    setSelectedJobId(job.id);
    setCurrentView("job-detail");
  };

  const handleBackToJobs = () => {
    setSelectedJobId(null);
    setCurrentView("jobs");
  };

  const [viewFilter, setViewFilter] = useState<string | undefined>(undefined);

  const handleSetView = (v: ViewId) => {
    setSelectedJobId(null);
    setViewFilter(undefined);
    setCurrentView(v);
  };

  const handleNavigateWithFilter = (view: string, filter?: string) => {
    setSelectedJobId(null);
    setViewFilter(filter);
    setCurrentView(view as ViewId);
  };

  if (sessionStatus === "loading" || (sessionStatus === "authenticated" && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-harvest-500 flex items-center justify-center font-extrabold text-2xl text-white mx-auto mb-3" style={{ fontFamily: "Georgia, serif" }}>F</div>
          <div className="text-lg font-bold text-stone-700 mb-2" style={{ fontFamily: "Georgia, serif" }}>FieldFlow</div>
          <div className="w-6 h-6 border-2 border-field-200 border-t-field-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (sessionStatus !== "authenticated") return null;

  const currentUser = users.find((u: any) => u.id === currentUserId) || null;

  const renderContent = () => {
    const dashboardProps = { onSelectJob: handleSelectJob, onNavigate: handleNavigateWithFilter };
    switch (currentView) {
      case "dashboard": return <Dashboard {...dashboardProps} />;
      case "jobs": return <JobsView onSelectJob={handleSelectJob} initialFilter={viewFilter} />;
      case "job-detail": return selectedJobId ? <JobDetail jobId={selectedJobId} onBack={handleBackToJobs} /> : <JobsView onSelectJob={handleSelectJob} />;
      case "customers": return <CustomersView />;
      case "invoices": return isAdmin ? <InvoicesView initialFilter={viewFilter} /> : <Dashboard {...dashboardProps} />;
      case "job-types": return <JobTypesView />;
      case "machines": return <MachinesView />;
      case "team": return isAdmin ? <TeamView /> : <Dashboard {...dashboardProps} />;
      default: return <Dashboard {...dashboardProps} />;
    }
  };

  return (
    <AppContext.Provider value={{ users, customers, fields, jobs, jobTypes, machines, invoices, currentUser, loading, refresh: loadAll }}>
      <div className="overflow-x-hidden w-full max-w-[100vw]">
        <Sidebar currentView={currentView} setView={handleSetView} session={session} />
        <MobileNav currentView={currentView} setView={handleSetView} />

        {/* Offline status & sync queue */}
        <OfflineBar onSynced={loadAll} />

        {/* Mobile header */}
        <header className="sticky top-0 z-40 bg-white border-b border-stone-200 px-4 py-3 flex justify-between items-center lg:hidden">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-harvest-500 flex items-center justify-center font-extrabold text-sm text-white">F</div>
            <span className="font-bold" style={{ fontFamily: "Georgia, serif" }}>FieldFlow</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500">{session?.user?.name?.split(" ")[0]}</span>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-xs text-stone-400 hover:text-stone-600 transition">
              Sign Out
            </button>
          </div>
        </header>

        <main className="lg:ml-64 px-4 sm:px-6 lg:px-10 py-6 lg:py-8 pb-24 lg:pb-8 min-h-screen overflow-x-hidden max-w-full">
          {renderContent()}
        </main>
      </div>
    </AppContext.Provider>
  );
}
