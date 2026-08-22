"use client";

import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import OfflineBar from "@/components/OfflineBar";

// ============================================================
// TYPES
// ============================================================
type ViewId = "dashboard" | "home" | "jobs" | "customers" | "invoices" | "machines" | "job-detail" | "team" | "job-types" | "work-orders" | "data-tools";

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
  jobGroups: any[];
  currentUser: any | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppState>({
  users: [], customers: [], fields: [], jobs: [], jobTypes: [], machines: [], invoices: [], jobGroups: [],
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
  approved: "bg-indigo-50 text-indigo-700 border-indigo-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
};

const statusDotColors: Record<string, string> = {
  scheduled: "bg-blue-500",
  in_progress: "bg-amber-500 animate-pulse",
  completed: "bg-emerald-500",
  approved: "bg-indigo-500",
  sent: "bg-blue-500",
  paid: "bg-emerald-500",
  overdue: "bg-red-500",
  draft: "bg-stone-400",
};

const statusLabel = (s: string) =>
  ({ scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled", draft: "Draft", approved: "Approved", sent: "Sent", paid: "Paid", overdue: "Overdue" }[s] || s);

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

// Today's date as a local YYYY-MM-DD string, for pre-filling <input type="date">
// defaults (an empty date input renders shorter on mobile, so job-creation
// forms default to today rather than starting blank)
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// A job can span multiple fields now — join their names for display wherever a single field name used to show
const fieldNames = (job: any) => (job.jobFields || []).map((jf: any) => jf.field?.fieldName).filter(Boolean).join(", ");

// A work log can involve multiple machines now — join their names for display wherever a single machine name used to show
const logMachineNames = (log: any) => (log.logMachines || []).map((lm: any) => lm.machine?.name).filter(Boolean).join(", ");

const fmtCurrency = (n: number) => `£${Number(n).toFixed(2)}`;

const roleLabel = (r: string) => ({ admin: "Admin", job_admin: "Job Admin", contractor: "Contractor" }[r] || r);
const roleBadgeStyle = (r: string) => ({
  admin: "bg-harvest-50 text-harvest-700",
  job_admin: "bg-blue-50 text-blue-700",
  contractor: "bg-field-50 text-field-700",
}[r] || "bg-stone-100 text-stone-600");

// ============================================================
// SHARED UI COMPONENTS
// ============================================================
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-base font-semibold border ${statusColors[status] || "bg-stone-100 text-stone-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusDotColors[status] || "bg-stone-400"}`} />
      {statusLabel(status)}
    </span>
  );
}

// Excel-style per-column filtering for desktop tables: each column gets a
// small text input under its header, and typing narrows rows to those whose
// value for that column contains the text (case-insensitive). Filters
// combine with AND across columns, and stack on top of any other filter
// (e.g. a status pill) already narrowing the row list passed in.
type ColumnFilter<T> = { key: string; label: string; get: (row: T) => string };

function useColumnFilters<T>(rows: T[], columns: ColumnFilter<T>[]) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const setFilter = (key: string, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({});
  const active = Object.values(filters).some((v) => v.trim());
  const filtered = active
    ? rows.filter((row) =>
        columns.every((col) => {
          const q = filters[col.key]?.trim().toLowerCase();
          if (!q) return true;
          return col.get(row).toLowerCase().includes(q);
        })
      )
    : rows;
  return { filters, setFilter, clearFilters, filtered, active };
}

function FilterRow<T>({ columns, filters, onChange, trailingCells = 0 }: {
  columns: ColumnFilter<T>[];
  filters: Record<string, string>;
  onChange: (key: string, value: string) => void;
  trailingCells?: number;
}) {
  return (
    <tr className="border-b border-stone-100 bg-stone-50/70">
      {columns.map((col) => (
        <th key={col.key} className="px-4 py-1.5 font-normal">
          <input
            value={filters[col.key] || ""}
            onChange={(e) => onChange(col.key, e.target.value)}
            placeholder="Filter..."
            className="w-full px-2 py-1 text-xs font-normal text-stone-700 border border-stone-200 rounded bg-white focus:outline-none focus:border-field-400 focus:ring-1 focus:ring-field-400/30"
          />
        </th>
      ))}
      {Array.from({ length: trailingCells }).map((_, i) => (
        <th key={`trailing-${i}`} />
      ))}
    </tr>
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
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 truncate">{title}</h1>
        {subtitle && <p className="text-lg text-stone-500 mt-0.5">{subtitle}</p>}
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
    <button className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-lg font-semibold transition-all duration-150 ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-base font-semibold text-stone-500 mb-1.5">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full px-3.5 py-3 border border-stone-300 rounded-lg text-lg bg-white focus:outline-none focus:border-field-500 focus:ring-2 focus:ring-field-500/20 transition placeholder:text-stone-400";

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-6 animate-[slideUp_0.3s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold">{title}</h2>
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
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-base text-stone-500 mt-0.5">{label}</div>
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

// Large Back/Next button row for step-by-step mobile flows (e.g. Log Work wizard)
function WizardNav({ onBack, onNext, nextLabel = "Next", nextDisabled, backLabel = "Back", saving }: {
  onBack?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean; backLabel?: string; saving?: boolean;
}) {
  return (
    <div className="flex gap-3 mt-6">
      {onBack && (
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-2xl text-lg font-bold text-stone-500 bg-stone-100 hover:bg-stone-200 transition"
        >
          {backLabel}
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className={`${onBack ? "flex-[2]" : "w-full"} py-4 rounded-2xl text-lg font-bold text-white bg-field-700 hover:bg-field-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm`}
      >
        {saving ? "Saving..." : nextLabel}
      </button>
    </div>
  );
}

// Bigger, bolder input style for step-by-step wizards (vs. the standard modal inputClass)
const wizardInputClass = "w-full px-4 py-4 border-2 border-stone-300 rounded-2xl text-lg font-semibold bg-white focus:outline-none focus:border-field-500 transition";

// Big tappable card list for single/multi-select wizard steps (e.g. "Which machine?", "Which customer?")
function WizardCardList({ items, isSelected, onToggle, renderMain, renderSub, showCheck, emptyText, className }: {
  items: any[]; isSelected: (item: any) => boolean; onToggle: (item: any) => void;
  renderMain: (item: any) => ReactNode; renderSub?: (item: any) => ReactNode;
  showCheck?: boolean; emptyText?: string; className?: string;
}) {
  if (items.length === 0) {
    return <div className="text-base text-stone-400 py-3 text-center border border-dashed border-stone-200 rounded-xl">{emptyText || "Nothing to show"}</div>;
  }
  return (
    <div className={className || "space-y-2.5 max-h-[50vh] overflow-y-auto"}>
      {items.map((item, i) => {
        const selected = isSelected(item);
        return (
          <button
            key={item.id ?? i}
            type="button"
            onClick={() => onToggle(item)}
            className={`w-full text-left px-4 py-4 rounded-2xl border-2 transition flex items-center justify-between gap-3 ${selected ? "border-field-600 bg-field-50" : "border-stone-200 bg-white hover:border-stone-300"}`}
          >
            <div className="min-w-0">
              <div className="font-bold text-lg truncate">{renderMain(item)}</div>
              {renderSub && <div className="text-base text-stone-500 truncate">{renderSub(item)}</div>}
            </div>
            {showCheck && selected && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-field-600 flex-shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// CREATE JOB WIZARD — big-button step flow for creating a Single Job or a
// Work Package, in the style of the Log Work wizard. Owns all its own form
// state; JobsView just controls whether it's open.
// ============================================================
const jobTypeBillingUnits = ["acre", "hectare", "hour", "item", "job", "tonne"];

function CreateJobWizard({ isOpen, onClose, skipModeSelect }: { isOpen: boolean; onClose: () => void; skipModeSelect?: boolean }) {
  const { customers, fields, jobTypes, users, jobGroups, currentUser, refresh } = useApp();
  const assignableUsers = users.filter((u: any) => u.active);
  const templates = jobGroups.filter((g: any) => g.isTemplate);
  const isAdmin = currentUser?.role === "admin";

  const [createMode, setCreateMode] = useState<"single" | "package">("single");
  const [wizardStep, setWizardStep] = useState(0);
  const [customerSearch, setCustomerSearch] = useState("");
  const [jobTypeSearch, setJobTypeSearch] = useState("");
  const [addingJobType, setAddingJobType] = useState(false);
  const [savingJobType, setSavingJobType] = useState(false);
  const [newJobType, setNewJobType] = useState({ name: "", billingUnit: "acre", defaultRate: "", vatApplicable: true });
  const [creating, setCreating] = useState(false);
  const [packageSaving, setPackageSaving] = useState(false);

  const blankForm = () => ({
    customerId: "", fieldIds: [] as string[], jobTypeId: "", assignedToUserId: "",
    title: "", description: "", plannedDate: todayStr(), estimatedQuantity: "", unitType: "",
    noLogRequired: false,
  });
  const [form, setForm] = useState(blankForm());
  const [titleAuto, setTitleAuto] = useState(true);
  const [addingField, setAddingField] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [newField, setNewField] = useState({ fieldName: "", hectares: "" });

  const blankPackageForm = () => ({
    name: "", customerId: "", templateId: "",
    fieldIds: [] as string[], assignedToUserId: "", plannedDate: todayStr(),
    noLogRequired: false,
    items: [] as Array<{ jobTypeId: string; notes: string }>,
  });
  const [packageForm, setPackageForm] = useState(blankPackageForm());

  // Reset everything fresh each time the wizard is opened
  useEffect(() => {
    if (!isOpen) return;
    setCreateMode("single");
    setWizardStep(skipModeSelect ? 1 : 0);
    setCustomerSearch("");
    setJobTypeSearch("");
    setForm(blankForm());
    setTitleAuto(true);
    setAddingField(false);
    setNewField({ fieldName: "", hectares: "" });
    setAddingJobType(false);
    setNewJobType({ name: "", billingUnit: "acre", defaultRate: "", vatApplicable: true });
    setPackageForm(blankPackageForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-generate the title from Job Type / Customer / Field(s) until the user types their own
  useEffect(() => {
    if (!titleAuto) return;
    const jt = jobTypes.find((j: any) => j.id === Number(form.jobTypeId));
    const cust = customers.find((c: any) => c.id === Number(form.customerId));
    if (!jt || !cust) return;
    let fieldSuffix = "";
    if (form.fieldIds.length === 1) {
      const fld = fields.find((f: any) => f.id === Number(form.fieldIds[0]));
      if (fld) fieldSuffix = ` - ${fld.fieldName}`;
    } else if (form.fieldIds.length > 1) {
      fieldSuffix = " - Multiple";
    }
    const generated = `${jt.name}${fieldSuffix}`;
    setForm(f => (f.title === generated ? f : { ...f, title: generated }));
  }, [form.jobTypeId, form.customerId, form.fieldIds, jobTypes, customers, fields, titleAuto]);

  const handleJobTypeChange = (jobTypeId: string) => {
    const jt = jobTypes.find((j: any) => j.id === Number(jobTypeId));
    setForm(f => ({ ...f, jobTypeId, unitType: jt?.billingUnit || "" }));
  };

  const handleClose = () => {
    onClose();
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.createJob({
        customerId: Number(form.customerId),
        fieldIds: form.fieldIds.map(Number),
        jobTypeId: Number(form.jobTypeId),
        assignedToUserId: form.assignedToUserId ? Number(form.assignedToUserId) : undefined,
        title: form.title,
        description: form.description || undefined,
        plannedDate: form.plannedDate || undefined,
        estimatedQuantity: form.estimatedQuantity ? Number(form.estimatedQuantity) : undefined,
        unitType: form.unitType || undefined,
        noLogRequired: form.noLogRequired,
      });
      await refresh();
      handleClose();
    } catch (err: any) {
      alert("Error creating job: " + err.message);
    }
    setCreating(false);
  };

  // Adds a field to the selected customer on the fly, so the database builds up as jobs are created
  const handleAddField = async () => {
    setSavingField(true);
    try {
      const created = await api.createField({
        customerId: Number(form.customerId),
        fieldName: newField.fieldName,
        hectares: Number(newField.hectares) || 0,
      });
      await refresh();
      setForm(f => ({ ...f, fieldIds: [...f.fieldIds, String(created.id)] }));
      setAddingField(false);
      setNewField({ fieldName: "", hectares: "" });
    } catch (err: any) {
      alert("Error adding field: " + err.message);
    }
    setSavingField(false);
  };

  // Adds a one-off job type on the fly (admin only — creating a type sets its
  // billing rate, same restriction as the standalone Job Types screen)
  const handleAddJobType = async () => {
    setSavingJobType(true);
    try {
      const created = await api.createJobType({
        name: newJobType.name,
        billingUnit: newJobType.billingUnit,
        defaultRate: Number(newJobType.defaultRate),
        vatApplicable: newJobType.vatApplicable,
      });
      await refresh();
      setForm(f => ({ ...f, jobTypeId: String(created.id), unitType: created.billingUnit }));
      setAddingJobType(false);
      setNewJobType({ name: "", billingUnit: "acre", defaultRate: "", vatApplicable: true });
    } catch (err: any) {
      alert("Error adding job type: " + err.message);
    }
    setSavingJobType(false);
  };

  // Picking a template seeds the item list client-side — no server round-trip needed
  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t: any) => String(t.id) === templateId);
    setPackageForm(f => ({
      ...f,
      templateId,
      name: template ? template.name : f.name,
      items: template
        ? (template.templateItems || []).map((item: any) => ({ jobTypeId: String(item.jobTypeId), notes: item.notes || "" }))
        : f.items,
    }));
  };

  const addPackageItem = () => setPackageForm(f => ({ ...f, items: [...f.items, { jobTypeId: "", notes: "" }] }));
  const removePackageItem = (i: number) => setPackageForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updatePackageItem = (i: number, field: string, value: string) =>
    setPackageForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: value } : item) }));

  const validPackageItems = packageForm.items.filter(item => item.jobTypeId);

  const handleCreatePackage = async () => {
    setPackageSaving(true);
    try {
      await api.createWorkPackage({
        name: packageForm.name || undefined,
        customerId: Number(packageForm.customerId),
        fieldIds: packageForm.fieldIds.map(Number),
        assignedToUserId: packageForm.assignedToUserId ? Number(packageForm.assignedToUserId) : undefined,
        plannedDate: packageForm.plannedDate || undefined,
        noLogRequired: packageForm.noLogRequired,
        items: validPackageItems.map(item => ({ jobTypeId: Number(item.jobTypeId), notes: item.notes || undefined })),
      });
      await refresh();
      handleClose();
    } catch (err: any) {
      alert("Error creating work package: " + err.message);
    }
    setPackageSaving(false);
  };

  if (!isOpen) return null;

  const filteredCustomers = customerSearch.trim()
    ? customers.filter((c: any) => c.name.toLowerCase().includes(customerSearch.trim().toLowerCase()))
    : customers;
  const filteredJobTypes = jobTypeSearch.trim()
    ? jobTypes.filter((jt: any) => jt.name.toLowerCase().includes(jobTypeSearch.trim().toLowerCase()))
    : jobTypes;
  const customerFields = form.customerId ? fields.filter((f: any) => f.customer?.id === Number(form.customerId)) : [];
  const packageCustomerFields = packageForm.customerId ? fields.filter((f: any) => f.customer?.id === Number(packageForm.customerId)) : [];
  const selectedCustomer = customers.find((c: any) => String(c.id) === form.customerId);
  const selectedJobType = jobTypes.find((jt: any) => String(jt.id) === form.jobTypeId);
  const selectedPackageCustomer = customers.find((c: any) => String(c.id) === packageForm.customerId);
  const totalSteps = createMode === "single" ? 4 : 5;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={handleClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-y-auto sm:max-h-[90vh] p-6 animate-[slideUp_0.3s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <div className="text-base font-bold uppercase tracking-wider text-stone-400">
            {wizardStep === 0 ? "Create" : `Step ${wizardStep} of ${totalSteps}`}
          </div>
          <button onClick={handleClose} className="text-stone-400 hover:text-stone-600 p-2 -mr-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Step 0: choose Single Job vs Work Package */}
        {wizardStep === 0 && (
          <>
            <h2 className="text-2xl font-bold mb-5">What would you like to create?</h2>
            <div className="space-y-2.5">
              <button type="button" onClick={() => setCreateMode("single")}
                className={`w-full text-left px-4 py-4 rounded-2xl border-2 transition ${createMode === "single" ? "border-field-600 bg-field-50" : "border-stone-200 bg-white hover:border-stone-300"}`}>
                <div className="font-bold text-lg">Single Job</div>
                <div className="text-base text-stone-500">One job for one customer</div>
              </button>
              <button type="button" onClick={() => setCreateMode("package")}
                className={`w-full text-left px-4 py-4 rounded-2xl border-2 transition ${createMode === "package" ? "border-field-600 bg-field-50" : "border-stone-200 bg-white hover:border-stone-300"}`}>
                <div className="font-bold text-lg">Work Package</div>
                <div className="text-base text-stone-500">Several jobs at once, optionally from a template</div>
              </button>
            </div>
            <WizardNav onNext={() => setWizardStep(1)} />
          </>
        )}

        {/* ══════════════ SINGLE JOB FLOW ══════════════ */}

        {createMode === "single" && wizardStep === 1 && (
          <>
            <h2 className="text-2xl font-bold mb-1">Customer & job type</h2>
            <p className="text-base text-stone-500 mb-4">Who's this job for, and what kind of job is it?</p>

            <div className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-2">Customer</div>
            {customers.length > 6 && (
              <input className={`${inputClass} mb-2`} placeholder="Search customers..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
            )}
            <WizardCardList
              className="space-y-2 max-h-[24vh] overflow-y-auto"
              items={filteredCustomers}
              isSelected={c => String(c.id) === form.customerId}
              onToggle={c => setForm(f => ({ ...f, customerId: String(c.id), fieldIds: [] }))}
              renderMain={c => c.name}
              renderSub={c => c.contact || undefined}
              emptyText="No customers match"
            />

            <div className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-2 mt-5">Job Type</div>
            {addingJobType ? (
              <div className="border-2 border-stone-200 rounded-2xl p-4 bg-stone-50 space-y-2.5">
                <input className={wizardInputClass} placeholder="Job type name (e.g. Fence Repair)" autoFocus value={newJobType.name} onChange={e => setNewJobType(f => ({ ...f, name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2.5">
                  <select className={wizardInputClass} value={newJobType.billingUnit} onChange={e => setNewJobType(f => ({ ...f, billingUnit: e.target.value }))}>
                    {jobTypeBillingUnits.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input className={wizardInputClass} type="number" step="0.01" placeholder="Rate (£)" value={newJobType.defaultRate} onChange={e => setNewJobType(f => ({ ...f, defaultRate: e.target.value }))} />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none px-1">
                  <input type="checkbox" className="accent-field-600 w-4 h-4" checked={newJobType.vatApplicable} onChange={e => setNewJobType(f => ({ ...f, vatApplicable: e.target.checked }))} />
                  <span className="text-base text-stone-600">VAT applicable (20%)</span>
                </label>
                <div className="flex gap-2.5">
                  <button type="button" onClick={() => { setAddingJobType(false); setNewJobType({ name: "", billingUnit: "acre", defaultRate: "", vatApplicable: true }); }}
                    className="flex-1 py-3.5 rounded-2xl text-base font-bold text-stone-500 bg-white border-2 border-stone-200 hover:bg-stone-100 transition">
                    Cancel
                  </button>
                  <button type="button" onClick={handleAddJobType} disabled={savingJobType || !newJobType.name || !newJobType.defaultRate}
                    className="flex-[2] py-3.5 rounded-2xl text-base font-bold text-white bg-field-700 hover:bg-field-800 disabled:opacity-50 disabled:cursor-not-allowed transition">
                    {savingJobType ? "Saving..." : "Save Job Type"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {jobTypes.length > 6 && (
                  <input className={`${inputClass} mb-2`} placeholder="Search job types..." value={jobTypeSearch} onChange={e => setJobTypeSearch(e.target.value)} />
                )}
                <WizardCardList
                  className="space-y-2 max-h-[24vh] overflow-y-auto"
                  items={filteredJobTypes}
                  isSelected={jt => String(jt.id) === form.jobTypeId}
                  onToggle={jt => handleJobTypeChange(String(jt.id))}
                  renderMain={jt => jt.name}
                  renderSub={jt => `${jt.billingUnit} · £${Number(jt.defaultRate)}`}
                  emptyText="No job types match"
                />
                {isAdmin && (
                  <button type="button" onClick={() => setAddingJobType(true)} className="mt-3 w-full py-3.5 rounded-2xl text-base font-bold text-field-700 bg-field-50 hover:bg-field-100 transition">
                    + Other — add a one-off job type
                  </button>
                )}
              </>
            )}

            <WizardNav onBack={() => setWizardStep(0)} onNext={() => setWizardStep(2)} nextDisabled={!form.customerId || !form.jobTypeId} />
          </>
        )}

        {createMode === "single" && wizardStep === 2 && (
          <>
            <h2 className="text-2xl font-bold mb-1">Which field(s)?</h2>
            <p className="text-base text-stone-500 mb-4">{selectedCustomer ? `Pick as many of ${selectedCustomer.name}'s fields as apply` : "Pick as many as apply"}</p>

            {addingField ? (
              <div className="border-2 border-stone-200 rounded-2xl p-4 bg-stone-50 space-y-2.5">
                <input className={wizardInputClass} placeholder="Field name (e.g. Top Field)" autoFocus value={newField.fieldName} onChange={e => setNewField(f => ({ ...f, fieldName: e.target.value }))} />
                <input className={wizardInputClass} type="number" step="0.1" placeholder="Acres" value={newField.hectares} onChange={e => setNewField(f => ({ ...f, hectares: e.target.value }))} />
                <div className="flex gap-2.5">
                  <button type="button" onClick={() => { setAddingField(false); setNewField({ fieldName: "", hectares: "" }); }}
                    className="flex-1 py-3.5 rounded-2xl text-base font-bold text-stone-500 bg-white border-2 border-stone-200 hover:bg-stone-100 transition">
                    Cancel
                  </button>
                  <button type="button" onClick={handleAddField} disabled={savingField || !newField.fieldName}
                    className="flex-[2] py-3.5 rounded-2xl text-base font-bold text-white bg-field-700 hover:bg-field-800 disabled:opacity-50 disabled:cursor-not-allowed transition">
                    {savingField ? "Saving..." : "Save Field"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <WizardCardList
                  items={customerFields}
                  isSelected={f => form.fieldIds.includes(String(f.id))}
                  onToggle={f => setForm(fm => ({ ...fm, fieldIds: fm.fieldIds.includes(String(f.id)) ? fm.fieldIds.filter(id => id !== String(f.id)) : [...fm.fieldIds, String(f.id)] }))}
                  renderMain={f => f.fieldName}
                  renderSub={f => `${Number(f.hectares)} acres`}
                  showCheck
                  emptyText="This customer has no fields yet"
                />
                <button type="button" onClick={() => setAddingField(true)} className="mt-3 w-full py-3.5 rounded-2xl text-base font-bold text-field-700 bg-field-50 hover:bg-field-100 transition">
                  + Add a new field
                </button>
              </>
            )}

            <WizardNav onBack={() => setWizardStep(1)} onNext={() => setWizardStep(3)} />
          </>
        )}

        {createMode === "single" && wizardStep === 3 && (
          <>
            <h2 className="text-2xl font-bold mb-4">Assignment & schedule</h2>

            <div className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-2">Assign to</div>
            <WizardCardList
              className="space-y-2 max-h-[22vh] overflow-y-auto mb-5"
              items={[{ id: "", name: "Unassigned" }, ...assignableUsers]}
              isSelected={u => (u.id ? String(u.id) : "") === form.assignedToUserId}
              onToggle={u => setForm(f => ({ ...f, assignedToUserId: u.id ? String(u.id) : "" }))}
              renderMain={u => u.name}
            />

            <FormField label="Planned Date">
              <input className={`${wizardInputClass} appearance-none block`} type="date" value={form.plannedDate} onChange={e => setForm(f => ({ ...f, plannedDate: e.target.value }))} />
            </FormField>
            <FormField label={`Estimated Qty${form.unitType ? ` (${form.unitType}s)` : ""}`}>
              <input className={wizardInputClass} type="number" step="0.25" inputMode="decimal" placeholder="0" value={form.estimatedQuantity} onChange={e => setForm(f => ({ ...f, estimatedQuantity: e.target.value }))} />
            </FormField>
            <FormField label="Notes">
              <textarea className={wizardInputClass} placeholder="Additional notes..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </FormField>

            <label className="flex items-start gap-2.5 px-1 py-2 cursor-pointer">
              <input type="checkbox" className="accent-field-600 w-4 h-4 flex-shrink-0 mt-0.5" checked={form.noLogRequired} onChange={e => setForm(f => ({ ...f, noLogRequired: e.target.checked }))} />
              <span className="text-base text-stone-600">This job doesn't need work logged (supply only, hire, etc.) — it can be marked completed without any logged work</span>
            </label>

            <WizardNav onBack={() => setWizardStep(2)} onNext={() => setWizardStep(4)} />
          </>
        )}

        {createMode === "single" && wizardStep === 4 && (
          <>
            <h2 className="text-2xl font-bold mb-5">Confirm & create</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                <span className="text-base text-stone-500">Customer</span>
                <span className="font-semibold text-base">{selectedCustomer?.name || "—"}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                <span className="text-base text-stone-500">Job Type</span>
                <span className="font-semibold text-base">{selectedJobType?.name || "—"}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                <span className="text-base text-stone-500">Field(s)</span>
                <span className="font-semibold text-base">
                  {form.fieldIds.length ? fields.filter((f: any) => form.fieldIds.includes(String(f.id))).map((f: any) => f.fieldName).join(", ") : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                <span className="text-base text-stone-500">Assigned to</span>
                <span className="font-semibold text-base">{assignableUsers.find((u: any) => String(u.id) === form.assignedToUserId)?.name || "Unassigned"}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                <span className="text-base text-stone-500">Date</span>
                <span className="font-semibold text-base">{fmtDate(form.plannedDate)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                <span className="text-base text-stone-500">Estimated Qty</span>
                <span className="font-semibold text-base">{form.estimatedQuantity ? `${form.estimatedQuantity} ${form.unitType || "units"}` : "—"}</span>
              </div>
            </div>
            <div className="mt-3">
              <FormField label="Title" required>
                <input className={inputClass} placeholder="e.g. Plough Top Field" value={form.title} onChange={e => {
                  setForm(f => ({ ...f, title: e.target.value }));
                  setTitleAuto(e.target.value.trim() === "");
                }} />
              </FormField>
            </div>
            <WizardNav onBack={() => setWizardStep(3)} onNext={handleCreate} nextLabel="Create Job" saving={creating} nextDisabled={creating || !form.title} />
          </>
        )}

        {/* ══════════════ WORK PACKAGE FLOW ══════════════ */}

        {createMode === "package" && wizardStep === 1 && (
          <>
            <h2 className="text-2xl font-bold mb-4">Customer</h2>
            <FormField label="Package Name (optional)">
              <input className={inputClass} placeholder={packageForm.customerId ? `${customers.find((c: any) => String(c.id) === packageForm.customerId)?.name || ""} - ${validPackageItems.length || 0} jobs` : "e.g. Autumn Ploughing"}
                value={packageForm.name} onChange={e => setPackageForm(f => ({ ...f, name: e.target.value }))} />
            </FormField>

            <div className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-2">Customer</div>
            {customers.length > 6 && (
              <input className={`${inputClass} mb-2`} placeholder="Search customers..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
            )}
            <WizardCardList
              className="space-y-2 max-h-[38vh] overflow-y-auto"
              items={filteredCustomers}
              isSelected={c => String(c.id) === packageForm.customerId}
              onToggle={c => setPackageForm(f => ({ ...f, customerId: String(c.id), fieldIds: [] }))}
              renderMain={c => c.name}
              renderSub={c => c.contact || undefined}
              emptyText="No customers match"
            />

            <WizardNav onBack={() => setWizardStep(0)} onNext={() => setWizardStep(2)} nextDisabled={!packageForm.customerId} />
          </>
        )}

        {createMode === "package" && wizardStep === 2 && (
          <>
            <h2 className="text-2xl font-bold mb-1">Job types</h2>
            <p className="text-base text-stone-500 mb-4">Start from a template, or add job types manually</p>

            <div className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-2">Template</div>
            <WizardCardList
              className="space-y-2 max-h-[20vh] overflow-y-auto"
              items={[{ id: "", name: "None — build manually" }, ...templates]}
              isSelected={t => (t.id ? String(t.id) : "") === packageForm.templateId}
              onToggle={t => handleTemplateSelect(t.id ? String(t.id) : "")}
              renderMain={t => t.name}
            />

            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold uppercase tracking-wider text-stone-400">Jobs in this package</label>
                <button type="button" onClick={addPackageItem} className="text-base text-field-700 font-bold hover:underline">+ Add Job Type</button>
              </div>
              {packageForm.items.length === 0 && (
                <div className="text-base text-stone-400 py-3 text-center border border-dashed border-stone-200 rounded-xl">
                  No jobs added yet — pick a template above or add one manually
                </div>
              )}
              {packageForm.items.map((item, i) => (
                <div key={i} className="flex gap-2 mb-2 items-center">
                  <span className="text-base text-stone-400 w-5 text-right flex-shrink-0">{i + 1}.</span>
                  <select className={`${inputClass} flex-1`} value={item.jobTypeId} onChange={e => updatePackageItem(i, "jobTypeId", e.target.value)}>
                    <option value="">Select job type...</option>
                    {jobTypes.map((jt: any) => <option key={jt.id} value={jt.id}>{jt.name}</option>)}
                  </select>
                  <input className={`${inputClass} flex-1`} placeholder="Notes (optional)" value={item.notes} onChange={e => updatePackageItem(i, "notes", e.target.value)} />
                  <button type="button" onClick={() => removePackageItem(i)} className="text-stone-400 hover:text-red-500 flex-shrink-0">✕</button>
                </div>
              ))}
            </div>

            <WizardNav onBack={() => setWizardStep(1)} onNext={() => setWizardStep(3)} nextDisabled={validPackageItems.length === 0} />
          </>
        )}

        {createMode === "package" && wizardStep === 3 && (
          <>
            <h2 className="text-2xl font-bold mb-1">Which field(s)?</h2>
            <p className="text-base text-stone-500 mb-4">{selectedPackageCustomer ? `Default fields for ${selectedPackageCustomer.name}'s jobs in this package` : "Default fields for this package"}</p>
            <WizardCardList
              items={packageCustomerFields}
              isSelected={f => packageForm.fieldIds.includes(String(f.id))}
              onToggle={f => setPackageForm(fm => ({ ...fm, fieldIds: fm.fieldIds.includes(String(f.id)) ? fm.fieldIds.filter(id => id !== String(f.id)) : [...fm.fieldIds, String(f.id)] }))}
              renderMain={f => f.fieldName}
              renderSub={f => `${Number(f.hectares)} acres`}
              showCheck
              emptyText="This customer has no fields yet"
            />
            <WizardNav onBack={() => setWizardStep(2)} onNext={() => setWizardStep(4)} />
          </>
        )}

        {createMode === "package" && wizardStep === 4 && (
          <>
            <h2 className="text-2xl font-bold mb-4">Defaults for every job</h2>
            <div className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-2">Assign to</div>
            <WizardCardList
              className="space-y-2 max-h-[30vh] overflow-y-auto mb-5"
              items={[{ id: "", name: "Unassigned" }, ...assignableUsers]}
              isSelected={u => (u.id ? String(u.id) : "") === packageForm.assignedToUserId}
              onToggle={u => setPackageForm(f => ({ ...f, assignedToUserId: u.id ? String(u.id) : "" }))}
              renderMain={u => u.name}
            />
            <FormField label="Planned Date">
              <input className={`${wizardInputClass} appearance-none block`} type="date" value={packageForm.plannedDate} onChange={e => setPackageForm(f => ({ ...f, plannedDate: e.target.value }))} />
            </FormField>
            <label className="flex items-start gap-2.5 px-1 py-2 cursor-pointer">
              <input type="checkbox" className="accent-field-600 w-4 h-4 flex-shrink-0 mt-0.5" checked={packageForm.noLogRequired} onChange={e => setPackageForm(f => ({ ...f, noLogRequired: e.target.checked }))} />
              <span className="text-base text-stone-600">These jobs don't need work logged (supply only, hire, etc.) — they can be marked completed without any logged work</span>
            </label>
            <WizardNav onBack={() => setWizardStep(3)} onNext={() => setWizardStep(5)} />
          </>
        )}

        {createMode === "package" && wizardStep === 5 && (
          <>
            <h2 className="text-2xl font-bold mb-5">Confirm & create</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                <span className="text-base text-stone-500">Customer</span>
                <span className="font-semibold text-base">{selectedPackageCustomer?.name || "—"}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                <span className="text-base text-stone-500">Jobs</span>
                <span className="font-semibold text-base">{validPackageItems.length}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                <span className="text-base text-stone-500">Field(s)</span>
                <span className="font-semibold text-base">
                  {packageForm.fieldIds.length ? fields.filter((f: any) => packageForm.fieldIds.includes(String(f.id))).map((f: any) => f.fieldName).join(", ") : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                <span className="text-base text-stone-500">Assigned to</span>
                <span className="font-semibold text-base">{assignableUsers.find((u: any) => String(u.id) === packageForm.assignedToUserId)?.name || "Unassigned"}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                <span className="text-base text-stone-500">Date</span>
                <span className="font-semibold text-base">{fmtDate(packageForm.plannedDate)}</span>
              </div>
            </div>
            <div className="mt-3">
              <FormField label="Package Name">
                <input className={inputClass} placeholder={`${selectedPackageCustomer?.name || ""} - ${validPackageItems.length} jobs`} value={packageForm.name} onChange={e => setPackageForm(f => ({ ...f, name: e.target.value }))} />
              </FormField>
            </div>
            <WizardNav
              onBack={() => setWizardStep(4)}
              onNext={handleCreatePackage}
              nextLabel={`Create Work Package (${validPackageItems.length} job${validPackageItems.length === 1 ? "" : "s"})`}
              saving={packageSaving}
              nextDisabled={packageSaving || !packageForm.customerId || validPackageItems.length === 0}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
const jobStatusOrder: Record<string, number> = { in_progress: 0, scheduled: 1, completed: 2 };

const isToday = (dateStr: string | null) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
};

// ============================================================
// MOBILE HOME — the phone/tablet landing page: today's jobs at a glance
// plus big, role-dependent shortcuts, instead of the fuller desktop Dashboard
// ============================================================
function MobileHome({ onSelectJob, onNavigate }: { onSelectJob?: (job: any) => void; onNavigate?: (view: string, filter?: string) => void }) {
  const { jobs, invoices, currentUser } = useApp();
  const role = currentUser?.role;
  const isAdmin = role === "admin";
  const canManageJobs = role === "admin" || role === "job_admin";

  const todaysJobs = [...jobs]
    .filter((j: any) => isToday(j.plannedDate))
    .sort((a: any, b: any) => (jobStatusOrder[a.status] ?? 3) - (jobStatusOrder[b.status] ?? 3));
  const pendingApproval = isAdmin ? invoices.filter((i: any) => i.status === "draft").length : 0;

  const todayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <PageHeader title={`Hi, ${currentUser?.name?.split(" ")[0] || ""}`} subtitle={todayLabel} />

      <div className="sm:grid sm:grid-cols-5 sm:gap-6">
        {/* Today's jobs */}
        <div className="sm:col-span-3">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-bold text-stone-900">Today's Jobs</h3>
            <button onClick={() => onNavigate?.("jobs")} className="text-base font-semibold text-field-700 hover:underline">View all</button>
          </div>
          {todaysJobs.length === 0 ? (
            <Card className="p-6 text-center">
              <div className="text-base text-stone-400">No jobs scheduled for today</div>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {todaysJobs.map((job: any) => (
                <Card key={job.id} className="p-4" onClick={() => onSelectJob?.(job)}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-lg truncate">{job.title}</div>
                      <div className="text-base text-stone-500 truncate">
                        {job.customer?.name}{fieldNames(job) ? ` · ${fieldNames(job)}` : ""}
                        {canManageJobs && job.assignedTo?.name ? ` · ${job.assignedTo.name}` : ""}
                      </div>
                    </div>
                    <div className="flex-shrink-0"><StatusBadge status={job.status} /></div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Big shortcuts */}
        <div className="sm:col-span-2 flex flex-col gap-3 mt-6 sm:mt-0">
          {canManageJobs && (
            <button
              onClick={() => onNavigate?.("jobs", "create")}
              className="w-full py-6 rounded-2xl text-xl font-bold text-white bg-field-700 hover:bg-field-800 shadow-sm transition text-left px-5"
            >
              + Create a New Job
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => onNavigate?.("invoices", "draft")}
              className="w-full py-6 rounded-2xl text-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition text-left px-5"
            >
              Invoices to Approve
              {pendingApproval > 0 && (
                <span className="block text-base font-semibold text-indigo-100 mt-1">{pendingApproval} waiting</span>
              )}
            </button>
          )}
          <button
            onClick={() => onNavigate?.("dashboard")}
            className="w-full py-6 rounded-2xl text-xl font-bold text-field-700 bg-field-200 hover:bg-field-300 shadow-sm transition text-left px-5"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ onSelectJob, onNavigate }: { onSelectJob?: (job: any) => void; onNavigate?: (view: string, filter?: string) => void }) {
  const { jobs, invoices, users, customers, currentUser, refresh } = useApp();
  const role = currentUser?.role;
  const isAdmin = role === "admin";
  const isContractor = role === "contractor";
  const [quickViewInvoice, setQuickViewInvoice] = useState<any>(null);
  const [invoiceActing, setInvoiceActing] = useState(false);

  const handleQuickApprove = async () => {
    if (!quickViewInvoice) return;
    if (!confirm("Approve this invoice? It will be locked from editing.")) return;
    setInvoiceActing(true);
    try {
      await api.approveInvoice(quickViewInvoice.id);
      await refresh();
      setQuickViewInvoice(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setInvoiceActing(false);
  };

  const handleQuickReject = async () => {
    if (!quickViewInvoice) return;
    const comment = prompt("Reason for rejecting this invoice (required):");
    if (comment === null) return;
    if (!comment.trim()) { alert("A comment is required to reject an invoice."); return; }
    setInvoiceActing(true);
    try {
      await api.rejectInvoice(quickViewInvoice.id, comment.trim());
      await refresh();
      setQuickViewInvoice(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setInvoiceActing(false);
  };

  const active = jobs.filter((j: any) => j.status !== "completed" && j.status !== "cancelled");
  const completed = jobs.filter((j: any) => j.status === "completed");
  const totalInvoiced = invoices.reduce((s: number, i: any) => s + Number(i.total), 0);
  const unpaid = invoices.filter((i: any) => i.status !== "paid");
  const needsApproval = invoices.filter((i: any) => i.status === "draft");
  const teamMembers = users;

  // Admins see the full financial picture; job admins and contractors don't need invoicing figures here
  const showFinance = isAdmin;
  // Contractors only need their own jobs — the Team card isn't relevant to them
  const showTeam = !isContractor;
  // Contractors care most about what's in progress right now, then what's coming up, then what's done
  const recentJobs = isContractor
    ? [...jobs].sort((a: any, b: any) => (jobStatusOrder[a.status] ?? 3) - (jobStatusOrder[b.status] ?? 3)).slice(0, 6)
    : jobs.slice(0, 6);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview" />

      <div className={`grid grid-cols-2 ${showFinance ? "lg:grid-cols-4" : ""} gap-4 mb-8`}>
        <div className="cursor-pointer" onClick={() => onNavigate?.("jobs", "active")}>
          <StatCard value={active.length} label="Active Jobs" color="text-field-700" />
        </div>
        <div className="cursor-pointer" onClick={() => onNavigate?.("jobs", "completed")}>
          <StatCard value={completed.length} label="Completed Jobs" color="text-emerald-600" />
        </div>
        {showFinance && (
          <>
            <div className="cursor-pointer" onClick={() => onNavigate?.("invoices")}>
              <StatCard value={fmtCurrency(totalInvoiced)} label="Invoiced" color="text-harvest-600" />
            </div>
            <div className="cursor-pointer" onClick={() => onNavigate?.("invoices", "unpaid")}>
              <StatCard value={unpaid.length} label="Unpaid Invoices" color="text-red-600" />
            </div>
          </>
        )}
      </div>

      {isAdmin && needsApproval.length > 0 && (
        <Card className="p-5 mb-6 border-indigo-200 bg-indigo-50/30">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-stone-900">Invoices Needing Approval</h3>
            <button onClick={() => onNavigate?.("invoices")} className="text-base font-semibold text-field-700 hover:underline">View all</button>
          </div>
          <div className="space-y-1">
            {needsApproval.map((inv: any) => (
              <div key={inv.id} onClick={() => setQuickViewInvoice(inv)} className="flex justify-between items-center gap-3 py-2.5 border-b border-stone-100 last:border-0 cursor-pointer hover:bg-white -mx-2 px-2 rounded-lg transition">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-lg truncate flex items-center gap-1.5">
                    {inv.invoiceNumber} · {inv.customer?.name}
                    {inv.rejectionComment && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-sm font-bold uppercase tracking-wide flex-shrink-0">Rejected</span>
                    )}
                  </div>
                  <div className="text-base text-stone-500 truncate">
                    {inv.rejectionComment ? <span className="text-red-600">{inv.rejectionComment}</span> : `Created by ${inv.createdByUser?.name || "—"}`}
                  </div>
                </div>
                <div className="flex-shrink-0 font-mono font-semibold text-lg">{fmtCurrency(Number(inv.total))}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className={showTeam ? "grid lg:grid-cols-2 gap-6" : ""}>
        <Card className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-stone-900">Recent Jobs</h3>
            <button onClick={() => onNavigate?.("jobs")} className="text-base font-semibold text-field-700 hover:underline">View all</button>
          </div>
          <div className="space-y-1">
            {recentJobs.map((job: any) => (
              <div key={job.id} onClick={() => onSelectJob?.(job)} className="flex justify-between items-center gap-3 py-2.5 border-b border-stone-100 last:border-0 cursor-pointer hover:bg-stone-50 -mx-2 px-2 rounded-lg transition">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-lg truncate">{job.title}</div>
                  <div className="text-base text-stone-500 truncate">{job.customer?.name} · {fmtDate(job.plannedDate)}</div>
                </div>
                <div className="flex-shrink-0"><StatusBadge status={job.status} /></div>
              </div>
            ))}
          </div>
        </Card>

        {showTeam && (
          <Card className="p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-stone-900">Team</h3>
              <button onClick={() => onNavigate?.("team")} className="text-base font-semibold text-field-700 hover:underline">Manage</button>
            </div>
            <div className="space-y-1">
              {teamMembers.map((user: any) => {
                const userJobs = jobs.filter((j: any) => j.assignedTo?.id === user.id && j.status !== "completed");
                return (
                  <div key={user.id} className="flex justify-between items-center gap-3 py-2.5 border-b border-stone-100 last:border-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-field-100 flex items-center justify-center text-field-700 font-bold text-base flex-shrink-0">
                        {user.name.split(" ").map((n: string) => n[0]).join("")}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-lg truncate">{user.name}</div>
                        <div className="text-base text-stone-500">{userJobs.length} active jobs</div>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${roleBadgeStyle(user.role)}`}>{roleLabel(user.role)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Invoice Quick View — approve/reject without leaving the dashboard */}
      <Modal isOpen={!!quickViewInvoice} onClose={() => setQuickViewInvoice(null)} title={quickViewInvoice?.invoiceNumber || ""}>
        {quickViewInvoice && (
          <div>
            <div className="grid grid-cols-2 gap-3 text-lg mb-4">
              <div><span className="text-stone-500">Customer:</span> <span className="font-medium">{quickViewInvoice.customer?.name}</span></div>
              <div><span className="text-stone-500">Total:</span> <span className="font-mono font-semibold">{fmtCurrency(Number(quickViewInvoice.total))}</span></div>
              <div><span className="text-stone-500">Created by:</span> <span className="font-medium">{quickViewInvoice.createdByUser?.name || "—"}</span></div>
              <div><span className="text-stone-500">Date:</span> <span className="font-medium">{fmtDate(quickViewInvoice.invoiceDate)}</span></div>
            </div>

            {quickViewInvoice.rejectionComment && (
              <div className="text-base text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 mb-4">
                Previously rejected: {quickViewInvoice.rejectionComment}
              </div>
            )}

            <div className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-2">Line Items</div>
            <div className="space-y-1.5 mb-5 max-h-48 overflow-y-auto">
              {(quickViewInvoice.items || []).map((item: any) => (
                <div key={item.id} className="flex justify-between items-center gap-3 py-2 border-b border-stone-100 last:border-0 text-lg">
                  <div className="min-w-0 flex-1 truncate">{item.description}</div>
                  <div className="flex-shrink-0 font-mono">{fmtCurrency(Number(item.totalPrice))}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleQuickReject}
                disabled={invoiceActing}
                className="flex-1 py-3 rounded-xl text-lg font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition"
              >
                Reject
              </button>
              {quickViewInvoice.createdBy !== currentUser?.id && (
                <button
                  onClick={handleQuickApprove}
                  disabled={invoiceActing}
                  className="flex-[2] py-3 rounded-xl text-lg font-semibold text-white bg-field-700 hover:bg-field-800 disabled:opacity-50 transition"
                >
                  {invoiceActing ? "Working..." : "Approve"}
                </button>
              )}
            </div>
            {quickViewInvoice.createdBy === currentUser?.id && (
              <div className="text-base text-stone-400 mt-2 text-center">You created this invoice — another admin needs to approve it.</div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============================================================
// JOBS
// ============================================================
function JobsView({ onSelectJob, initialFilter }: { onSelectJob: (job: any) => void; initialFilter?: string }) {
  const { jobs, currentUser } = useApp();
  const canManageJobs = currentUser?.role === "admin" || currentUser?.role === "job_admin";
  // "create" is a signal from MobileHome's shortcut button to open the modal directly, not a real status filter
  const [filter, setFilter] = useState(initialFilter && initialFilter !== "create" ? initialFilter : "all");
  const [showCreate, setShowCreate] = useState(initialFilter === "create" && canManageJobs);

  const statusFiltered = filter === "all" ? jobs : (filter === "active" ? jobs.filter((j: any) => j.status === "scheduled" || j.status === "in_progress") : jobs.filter((j: any) => j.status === filter));

  const jobFilterColumns: ColumnFilter<any>[] = [
    { key: "job", label: "Job", get: (j) => j.title || "" },
    { key: "customer", label: "Customer", get: (j) => j.customer?.name || "" },
    { key: "field", label: "Field", get: (j) => fieldNames(j) || "" },
    { key: "type", label: "Type", get: (j) => j.jobType?.name || "" },
    { key: "assigned", label: "Assigned To", get: (j) => j.assignedTo?.name || "" },
    { key: "date", label: "Date", get: (j) => fmtDate(j.plannedDate) },
    { key: "qty", label: "Est. Qty", get: (j) => j.estimatedQuantity ? `${Number(j.estimatedQuantity)} ${j.unitType || "units"}` : "" },
    { key: "status", label: "Status", get: (j) => statusLabel(j.status) },
  ];
  const { filters: colFilters, setFilter: setColFilter, clearFilters, filtered, active: filtersActive } = useColumnFilters(statusFiltered, jobFilterColumns);

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle={`${jobs.length} total jobs`}
        action={canManageJobs ? <Btn onClick={() => setShowCreate(true)}>+ New Job</Btn> : undefined}
      />

      <div className="flex gap-2 mb-5 flex-wrap items-center">
        {["all", "active", "scheduled", "in_progress", "completed"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2.5 rounded-xl text-base font-semibold transition ${filter === f ? "bg-field-100 text-field-700" : "text-stone-500 hover:bg-stone-100"}`}>
            {f === "all" ? "All" : f === "active" ? "Active" : statusLabel(f)}
          </button>
        ))}
        {filtersActive && (
          <Btn variant="secondary" onClick={clearFilters} className="!px-4 !py-2 !text-base">Reset Filters</Btn>
        )}
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
            <FilterRow columns={jobFilterColumns} filters={colFilters} onChange={setColFilter} />
          </thead>
          <tbody>
            {filtered.map((job: any) => (
              <tr key={job.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer transition" onClick={() => onSelectJob(job)}>
                <td className="px-4 py-3 font-semibold text-sm">{job.title}</td>
                <td className="px-4 py-3 text-sm">{job.customer?.name}</td>
                <td className="px-4 py-3 text-sm">{fieldNames(job) || "—"}</td>
                <td className="px-4 py-3 text-sm">{job.jobType?.name}</td>
                <td className="px-4 py-3 text-sm">{job.assignedTo?.name || "—"}</td>
                <td className="px-4 py-3 text-sm">{fmtDate(job.plannedDate)}</td>
                <td className="px-4 py-3 text-sm font-mono">{job.estimatedQuantity ? `${Number(job.estimatedQuantity)} ${job.unitType || "units"}` : "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="text-stone-400 text-sm mb-3">No jobs found</div>
            {filtersActive && <Btn variant="secondary" onClick={clearFilters}>Reset Filters</Btn>}
          </div>
        )}
      </Card>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-2.5">
        {filtered.map((job: any) => (
          <Card key={job.id} className="p-4" onClick={() => onSelectJob(job)}>
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="font-bold text-lg min-w-0 flex-1 truncate">{job.title}</div>
              <div className="flex-shrink-0"><StatusBadge status={job.status} /></div>
            </div>
            <div className="text-base text-stone-500 space-y-0.5">
              <div className="truncate">{job.customer?.name}{fieldNames(job) ? ` · ${fieldNames(job)}` : ""}</div>
              <div>{fmtDate(job.plannedDate)} · {job.estimatedQuantity ? `${Number(job.estimatedQuantity)} ${job.unitType || "units"}` : ""}</div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="text-stone-400 text-base mb-3">No jobs found</div>
            {filtersActive && <Btn variant="secondary" onClick={clearFilters}>Reset Filters</Btn>}
          </div>
        )}
      </div>

      {/* Create Job Wizard */}
      <CreateJobWizard
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        skipModeSelect={initialFilter === "create"}
      />
    </div>
  );
}

// ============================================================
// JOB DETAIL
// ============================================================
function JobDetail({ jobId, onBack }: { jobId: number; onBack: () => void }) {
  const { machines, users, currentUser, refresh } = useApp();
  const canManageJobs = currentUser?.role === "admin" || currentUser?.role === "job_admin";
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logStep, setLogStep] = useState(0);
  const [logSaving, setLogSaving] = useState(false);
  const [logForm, setLogForm] = useState({ machineIds: [] as string[], quantityCompleted: "", notes: "" });
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ assignedToUserId: "", plannedDate: "", title: "", description: "", estimatedQuantity: "", noLogRequired: false });

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
  const invoiced = (job.invoiceItems || []).length > 0;

  const openEdit = () => {
    setEditForm({
      assignedToUserId: job.assignedTo?.id ? String(job.assignedTo.id) : "",
      plannedDate: job.plannedDate ? new Date(job.plannedDate).toISOString().split("T")[0] : "",
      title: job.title || "",
      description: job.description || "",
      estimatedQuantity: job.estimatedQuantity ? String(Number(job.estimatedQuantity)) : "",
      noLogRequired: !!job.noLogRequired,
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
        noLogRequired: editForm.noLogRequired,
      });
      await loadJob();
      await refresh();
      setShowEditForm(false);
    } catch (err: any) {
      alert("Error updating job: " + err.message);
    }
    setEditSaving(false);
  };

  const closeLogForm = () => {
    setShowLogForm(false);
    setLogStep(0);
    setLogForm({ machineIds: [], quantityCompleted: "", notes: "" });
  };

  const handleLogWork = async () => {
    setLogSaving(true);
    try {
      const result = await api.createJobLog({
        jobId: job.id,
        contractorId: job.assignedTo?.id || assignableUsers[0]?.id,
        machineIds: logForm.machineIds.map(Number),
        quantityCompleted: Number(logForm.quantityCompleted),
        hoursWorked: 0,
        notes: logForm.notes || undefined,
      });
      if ((result as any)?.queued) {
        // Queued for later sync — close form and show confirmation
        closeLogForm();
      } else {
        await loadJob();
        await refresh();
        closeLogForm();
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
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-base text-stone-500 hover:text-stone-700 transition mb-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Back to jobs
      </button>

      <Card className="p-5 mb-4">
        <div className="flex justify-between items-start gap-2 mb-4">
          <h2 className="text-2xl font-bold min-w-0 flex-1 truncate">{job.title}</h2>
          <div className="flex gap-2 flex-shrink-0 items-center">
            {canManageJobs && (
              <button onClick={openEdit} className="px-5 py-3 rounded-xl text-base font-bold text-field-700 bg-field-50 hover:bg-field-100 transition">
                Edit
              </button>
            )}
            <StatusBadge status={job.status} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-base">
          <div><span className="text-stone-500">Customer:</span> <span className="font-medium">{job.customer?.name}</span></div>
          <div><span className="text-stone-500">Field:</span> <span className="font-medium">{fieldNames(job) || "—"}</span></div>
          <div><span className="text-stone-500">Type:</span> <span className="font-medium">{job.jobType?.name}</span></div>
          <div><span className="text-stone-500">Assigned:</span> <span className="font-medium">{job.assignedTo?.name || "Unassigned"}</span></div>
          <div><span className="text-stone-500">Date:</span> <span className="font-medium">{fmtDate(job.plannedDate)}</span></div>
          <div><span className="text-stone-500">Estimated:</span> <span className="font-medium">{estQty ? `${estQty} ${job.unitType || "units"}` : "—"}</span></div>
        </div>
        {job.description && <p className="mt-3 text-base text-stone-500 italic">{job.description}</p>}
        {job.noLogRequired && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-harvest-50 text-harvest-700 text-sm font-semibold">
            No work log required to complete
          </div>
        )}

        {/* Status actions — large, stacked, full-width for easy tapping in the field */}
        <div className="flex flex-col gap-3 mt-5 pt-4 border-t border-stone-100">
          {job.status !== "completed" && job.status !== "cancelled" && (
            <button
              onClick={() => setShowLogForm(true)}
              className="w-full py-4 rounded-2xl text-lg font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-sm transition"
            >
              + Log Work
            </button>
          )}
          {job.status === "scheduled" && (
            <button
              onClick={() => handleStatusChange("in_progress")}
              disabled={statusUpdating}
              className="w-full py-4 rounded-2xl text-lg font-bold text-white bg-harvest-500 hover:bg-harvest-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              Mark In Progress
            </button>
          )}
          {job.status === "in_progress" && (
            <>
              <button
                onClick={() => handleStatusChange("completed")}
                disabled={statusUpdating || (logs.length === 0 && !job.noLogRequired)}
                className="w-full py-4 rounded-2xl text-lg font-bold text-white bg-field-700 hover:bg-field-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                Mark Completed
              </button>
              {logs.length === 0 && !job.noLogRequired && (
                <p className="text-base text-stone-400 text-center -mt-1.5">Log some work first — a job can't be completed with nothing logged</p>
              )}
            </>
          )}
          {job.status === "completed" && (
            <>
              <button
                onClick={() => handleStatusChange("in_progress")}
                disabled={statusUpdating || invoiced}
                className="w-full py-4 rounded-2xl text-lg font-bold text-field-700 bg-field-50 hover:bg-field-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Reopen Job
              </button>
              {invoiced && (
                <p className="text-base text-stone-400 text-center -mt-1.5">This job has been invoiced and can't be reopened</p>
              )}
            </>
          )}
          {canManageJobs && (
            <>
              <button
                onClick={async () => {
                  if (!confirm(`Delete "${job.title}"? This will also delete all work logs for this job.`)) return;
                  try { await api.deleteJob(job.id); await refresh(); onBack(); } catch (err: any) { alert("Error: " + err.message); }
                }}
                disabled={invoiced}
                className="w-full py-4 rounded-2xl text-lg font-bold text-red-700 bg-red-50 hover:bg-red-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:hover:text-red-700 transition"
              >
                Delete Job
              </button>
              {invoiced && (
                <p className="text-base text-stone-400 text-center -mt-1.5">This job has been invoiced and can't be deleted</p>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Progress */}
      <Card className="p-5 mb-4">
        <div className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-3">Progress</div>
        <div className="flex gap-8 mb-3">
          <div>
            <span className="text-3xl font-bold">{totalQty}</span>
            <span className="text-lg text-stone-500">{estQty ? ` / ${estQty}` : ""} {job.unitType || "units"} completed</span>
          </div>
        </div>
        {estQty > 0 && (
          <>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? "bg-emerald-500" : "bg-field-600"}`} style={{ width: `${progress}%` }} />
            </div>
            <div className="text-right text-base text-stone-400 mt-1">{progress}% complete</div>
          </>
        )}
      </Card>

      {/* Work Logs */}
      {logs.length > 0 && (
        <div>
          <div className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-2">Work Logs</div>
          <div className="space-y-2">
            {logs.map((log: any) => (
              <Card key={log.id} className="p-4">
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">{logMachineNames(log) || "No machine"}</span>
                  <span className="text-stone-400 text-base">{fmtDate(log.createdAt)}</span>
                </div>
                <div className="text-base text-stone-500 mt-1">
                  {Number(log.quantityCompleted)} {job.unitType || "units"}
                  {log.contractor && <span> · {log.contractor.name}</span>}
                </div>
                {log.notes && <p className="text-base text-stone-500 mt-2 italic">{log.notes}</p>}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Log Work Wizard — one big decision per screen, full-screen on mobile, standard on desktop */}
      {showLogForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={closeLogForm}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-y-auto sm:max-h-[90vh] p-6 animate-[slideUp_0.3s_ease-out]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center mb-2">
              <div className="text-base font-bold uppercase tracking-wider text-stone-400">Step {logStep + 1} of 4</div>
              <button onClick={closeLogForm} className="text-stone-400 hover:text-stone-600 p-2 -mr-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Step 1: Machine(s) */}
            {logStep === 0 && (
              <>
                <h2 className="text-2xl font-bold mb-5">Which machine(s)?</h2>
                <div className="space-y-2.5 max-h-[55vh] overflow-y-auto">
                  <button
                    onClick={() => setLogForm(f => ({ ...f, machineIds: [] }))}
                    className={`w-full text-left px-4 py-4 rounded-2xl border-2 transition ${logForm.machineIds.length === 0 ? "border-field-600 bg-field-50" : "border-stone-200 bg-white hover:border-stone-300"}`}
                  >
                    <div className="font-bold text-lg">No machine</div>
                    <div className="text-base text-stone-500">Not applicable for this job</div>
                  </button>
                  {machines.filter((m: any) => m.active).map((m: any) => {
                    const selected = logForm.machineIds.includes(String(m.id));
                    return (
                      <button
                        key={m.id}
                        onClick={() => setLogForm(f => ({
                          ...f,
                          machineIds: selected ? f.machineIds.filter(id => id !== String(m.id)) : [...f.machineIds, String(m.id)],
                        }))}
                        className={`w-full text-left px-4 py-4 rounded-2xl border-2 transition flex items-center justify-between gap-3 ${selected ? "border-field-600 bg-field-50" : "border-stone-200 bg-white hover:border-stone-300"}`}
                      >
                        <div>
                          <div className="font-bold text-lg">{m.name}</div>
                          <div className="text-base text-stone-500">{m.registration}</div>
                        </div>
                        {selected && (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-field-600 flex-shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
                        )}
                      </button>
                    );
                  })}
                </div>
                <WizardNav onNext={() => setLogStep(1)} />
              </>
            )}

            {/* Step 2: Qty */}
            {logStep === 1 && (
              <>
                <h2 className="text-2xl font-bold mb-5">How much did you complete?</h2>
                <label className="block text-base font-bold text-stone-600 mb-2">
                  Qty ({job.unitType || "units"}) <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-4 py-5 border-2 border-stone-300 rounded-2xl text-5xl font-bold text-center bg-white focus:outline-none focus:border-field-500 transition"
                  type="number" step="0.1" inputMode="decimal" placeholder="0" autoFocus
                  value={logForm.quantityCompleted}
                  onChange={e => setLogForm(f => ({ ...f, quantityCompleted: e.target.value }))}
                />
                <WizardNav onBack={() => setLogStep(0)} onNext={() => setLogStep(2)} nextDisabled={!logForm.quantityCompleted} />
              </>
            )}

            {/* Step 3: Notes */}
            {logStep === 2 && (
              <>
                <h2 className="text-2xl font-bold mb-5">Anything to note?</h2>
                <label className="block text-base font-bold text-stone-600 mb-2">Notes (optional)</label>
                <textarea
                  className="w-full px-4 py-3 border-2 border-stone-300 rounded-2xl text-lg bg-white focus:outline-none focus:border-field-500 transition"
                  placeholder="Conditions, issues, anything to note..."
                  rows={5}
                  value={logForm.notes}
                  onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))}
                />
                <WizardNav onBack={() => setLogStep(1)} onNext={() => setLogStep(3)} />
              </>
            )}

            {/* Step 4: Review & save */}
            {logStep === 3 && (
              <>
                <h2 className="text-2xl font-bold mb-5">Confirm & save</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                    <span className="text-base text-stone-500">Machine(s)</span>
                    <span className="font-semibold text-base">
                      {logForm.machineIds.length
                        ? machines.filter((m: any) => logForm.machineIds.includes(String(m.id))).map((m: any) => m.name).join(", ")
                        : "No machine"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-stone-50">
                    <span className="text-base text-stone-500">Qty</span>
                    <span className="font-semibold text-base">{logForm.quantityCompleted || 0} {job.unitType || "units"}</span>
                  </div>
                  {logForm.notes && (
                    <div className="px-4 py-3.5 rounded-xl bg-stone-50">
                      <div className="text-base text-stone-500 mb-1">Notes</div>
                      <div className="text-base italic">{logForm.notes}</div>
                    </div>
                  )}
                </div>
                <WizardNav
                  onBack={() => setLogStep(2)}
                  onNext={handleLogWork}
                  nextLabel="Save Log"
                  nextDisabled={logSaving || !logForm.quantityCompleted}
                  saving={logSaving}
                />
              </>
            )}
          </div>
        </div>
      )}

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Planned Date">
            <input className={`${inputClass} appearance-none block`} type="date" value={editForm.plannedDate} onChange={e => setEditForm(f => ({ ...f, plannedDate: e.target.value }))} />
          </FormField>
          <FormField label={`Estimated Qty${job.unitType ? ` (${job.unitType}s)` : ""}`}>
            <input className={inputClass} type="number" step="0.25" value={editForm.estimatedQuantity} onChange={e => setEditForm(f => ({ ...f, estimatedQuantity: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Description">
          <textarea className={inputClass} rows={3} placeholder="Notes, instructions..." value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
        </FormField>
        <label className="flex items-start gap-2.5 px-1 py-2 mb-2 cursor-pointer">
          <input type="checkbox" className="accent-field-600 w-4 h-4 flex-shrink-0 mt-0.5" checked={editForm.noLogRequired} onChange={e => setEditForm(f => ({ ...f, noLogRequired: e.target.checked }))} />
          <span className="text-base text-stone-600">This job doesn't need work logged (supply only, hire, etc.) — it can be marked completed without any logged work</span>
        </label>
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
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [showEditFieldForm, setShowEditFieldForm] = useState(false);
  const [editFieldForm, setEditFieldForm] = useState({ fieldName: "", hectares: "", notes: "" });
  const [editFieldSaving, setEditFieldSaving] = useState(false);

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

  const openEditField = (f: any) => {
    setEditingFieldId(f.id);
    setEditFieldForm({ fieldName: f.fieldName, hectares: String(Number(f.hectares)), notes: f.notes || "" });
    setShowEditFieldForm(true);
  };

  const handleEditFieldSave = async () => {
    if (!editingFieldId) return;
    setEditFieldSaving(true);
    try {
      await api.updateField(editingFieldId, {
        fieldName: editFieldForm.fieldName,
        hectares: Number(editFieldForm.hectares) || 0,
        notes: editFieldForm.notes || undefined,
      });
      await refresh();
      setShowEditFieldForm(false);
    } catch (err: any) { alert("Error: " + err.message); }
    setEditFieldSaving(false);
  };

  const customerFilterColumns: ColumnFilter<any>[] = [
    { key: "name", label: "Name", get: (c) => c.name || "" },
    { key: "contact", label: "Contact", get: (c) => c.contact || "" },
    { key: "phone", label: "Phone", get: (c) => c.phone || "" },
    { key: "email", label: "Email", get: (c) => c.email || "" },
    { key: "fields", label: "Fields", get: (c) => String((c.fields || []).length) },
    { key: "acres", label: "Acres", get: (c) => String((c.fields || []).reduce((s: number, f: any) => s + Number(f.hectares), 0)) },
  ];
  const { filters: custColFilters, setFilter: setCustColFilter, clearFilters: clearCustFilters, filtered: filteredCustomers, active: custFiltersActive } =
    useColumnFilters(customers, customerFilterColumns);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customers`}
        action={<Btn onClick={openCreate}>+ Add Customer</Btn>}
      />

      {custFiltersActive && (
        <div className="mb-4">
          <Btn variant="secondary" onClick={clearCustFilters} className="!px-4 !py-2 !text-base">Reset Filters</Btn>
        </div>
      )}

      {/* Desktop table */}
      <Card className="overflow-hidden hidden lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-stone-200">
              {["Name", "Contact", "Phone", "Email", "Fields", "Acres", "Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">{h}</th>
              ))}
            </tr>
            <FilterRow columns={customerFilterColumns} filters={custColFilters} onChange={setCustColFilter} trailingCells={1} />
          </thead>
          <tbody>
            {filteredCustomers.map((c: any) => {
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
                              <div key={f.id} className="bg-white rounded-lg px-3 py-2 border border-stone-200">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="text-sm font-medium">{f.fieldName}</span>
                                    <span className="text-xs text-stone-500 ml-2">{Number(f.hectares)} ac</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => openEditField(f)} className="text-xs text-field-700 hover:underline">Edit</button>
                                    <button onClick={() => handleDeleteField(f.id, f.fieldName)} className="text-xs text-red-500 hover:underline">Remove</button>
                                  </div>
                                </div>
                                {f.notes && <p className="text-xs text-stone-400 mt-1 italic">{f.notes}</p>}
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
        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-stone-400 text-sm mb-3">
              {customers.length === 0 ? "No customers yet" : "No customers match your filters"}
            </div>
            {custFiltersActive && <Btn variant="secondary" onClick={clearCustFilters}>Reset Filters</Btn>}
          </div>
        )}
      </Card>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-2.5">
        {filteredCustomers.map((c: any) => {
          const custFields = (c.fields || []);
          const totalHa = custFields.reduce((s: number, f: any) => s + Number(f.hectares), 0);
          const isExpanded = expandedId === c.id;
          return (
            <Card key={c.id} className="p-4">
              <div className="flex justify-between items-start gap-2" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-lg truncate">{c.name}</div>
                  <div className="text-base text-stone-500 mt-0.5 truncate">
                    {c.contact && <span>{c.contact} · </span>}{c.phone}
                  </div>
                  <div className="text-base text-stone-400 mt-0.5">{custFields.length} fields · {totalHa} ac</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="px-2.5 py-1.5 text-base font-medium text-field-700 bg-field-50 rounded hover:bg-field-100 transition">Edit</button>
                </div>
              </div>
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold uppercase tracking-wider text-stone-500">Fields</span>
                    <button onClick={() => openAddField(c.id)} className="text-base font-semibold text-field-700">+ Add</button>
                  </div>
                  {custFields.map((f: any) => (
                    <div key={f.id} className="py-1.5 border-b border-stone-100 last:border-0">
                      <div className="flex justify-between items-center">
                        <div className="text-lg">{f.fieldName} <span className="text-stone-400 text-base">{Number(f.hectares)} ac</span></div>
                        <div className="flex gap-2">
                          <button onClick={() => openEditField(f)} className="text-base text-field-700">Edit</button>
                          <button onClick={() => handleDeleteField(f.id, f.fieldName)} className="text-base text-red-500">Remove</button>
                        </div>
                      </div>
                      {f.notes && <p className="text-base text-stone-400 mt-0.5 italic">{f.notes}</p>}
                    </div>
                  ))}
                  {custFields.length === 0 && <div className="text-base text-stone-400">No fields</div>}
                </div>
              )}
            </Card>
          );
        })}
        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-stone-400 text-base mb-3">
              {customers.length === 0 ? "No customers yet" : "No customers match your filters"}
            </div>
            {custFiltersActive && <Btn variant="secondary" onClick={clearCustFilters}>Reset Filters</Btn>}
          </div>
        )}
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
          <textarea className={inputClass} placeholder="Access info, soil type, hazards..." rows={3} value={fieldForm.notes} onChange={e => setFieldForm(f => ({ ...f, notes: e.target.value }))} />
        </FormField>
        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowFieldForm(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleSaveField} disabled={fieldSaving || !fieldForm.fieldName}>
            {fieldSaving ? "Saving..." : "Add Field"}
          </Btn>
        </div>
      </Modal>

      {/* Edit Field Modal */}
      <Modal isOpen={showEditFieldForm} onClose={() => setShowEditFieldForm(false)} title="Edit Field">
        <FormField label="Field Name" required>
          <input className={inputClass} value={editFieldForm.fieldName} onChange={e => setEditFieldForm(f => ({ ...f, fieldName: e.target.value }))} />
        </FormField>
        <FormField label="Acres">
          <input className={inputClass} type="number" step="0.1" value={editFieldForm.hectares} onChange={e => setEditFieldForm(f => ({ ...f, hectares: e.target.value }))} />
        </FormField>
        <FormField label="Notes">
          <textarea className={inputClass} placeholder="Access info, soil type, hazards..." rows={3} value={editFieldForm.notes} onChange={e => setEditFieldForm(f => ({ ...f, notes: e.target.value }))} />
        </FormField>
        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowEditFieldForm(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleEditFieldSave} disabled={editFieldSaving || !editFieldForm.fieldName}>
            {editFieldSaving ? "Saving..." : "Save Changes"}
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
  const { invoices, customers, jobs, currentUser, refresh } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [extraItems, setExtraItems] = useState<Array<{ description: string; quantity: string; unitPrice: string; vatApplicable: boolean }>>([]);
  const [filter, setFilter] = useState(initialFilter || "all");
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [editItems, setEditItems] = useState<Array<{ description: string; quantity: string; unitPrice: string; vatApplicable: boolean; jobId?: number | null }>>([]);
  const [editSaving, setEditSaving] = useState(false);

  const addExtraItem = () => setExtraItems(prev => [...prev, { description: "", quantity: "1", unitPrice: "", vatApplicable: true }]);
  const removeExtraItem = (i: number) => setExtraItems(prev => prev.filter((_, idx) => idx !== i));
  const updateExtraItem = (i: number, field: string, value: string | boolean) =>
    setExtraItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const openEditInvoice = (inv: any) => {
    setEditingInvoice(inv);
    setEditItems((inv.items || []).map((item: any) => ({
      description: item.description,
      quantity: String(Number(item.quantity)),
      unitPrice: String(Number(item.unitPrice)),
      vatApplicable: item.vatApplicable !== false,
      jobId: item.jobId ?? null,
    })));
  };
  const removeEditItem = (i: number) => setEditItems(prev => prev.filter((_, idx) => idx !== i));
  const updateEditItem = (i: number, field: string, value: string | boolean) =>
    setEditItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  const addEditItem = () => setEditItems(prev => [...prev, { description: "", quantity: "1", unitPrice: "", vatApplicable: true, jobId: null }]);

  const handleEditSave = async () => {
    if (!editingInvoice) return;
    setEditSaving(true);
    try {
      const validItems = editItems.filter(item => item.description.trim() && item.unitPrice);
      await api.updateInvoice(editingInvoice.id, {
        items: validItems.map(item => ({
          description: item.description.trim(),
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice),
          vatApplicable: item.vatApplicable,
          jobId: item.jobId ?? null,
        })),
      });
      await refresh();
      setEditingInvoice(null);
    } catch (err: any) {
      alert("Error saving invoice: " + err.message);
    }
    setEditSaving(false);
  };

  const statusFilteredInvoices = filter === "all" ? invoices : (filter === "unpaid" ? invoices.filter((i: any) => i.status !== "paid") : invoices.filter((i: any) => i.status === filter));

  const invoiceFilterColumns: ColumnFilter<any>[] = [
    { key: "number", label: "Invoice #", get: (i) => i.invoiceNumber || "" },
    { key: "customer", label: "Customer", get: (i) => i.customer?.name || "" },
    { key: "date", label: "Date", get: (i) => fmtDate(i.invoiceDate) },
    { key: "due", label: "Due", get: (i) => fmtDate(i.dueDate) },
    { key: "subtotal", label: "Subtotal", get: (i) => fmtCurrency(Number(i.subtotal)) },
    { key: "vat", label: "VAT", get: (i) => fmtCurrency(Number(i.vat)) },
    { key: "total", label: "Total", get: (i) => fmtCurrency(Number(i.total)) },
    { key: "status", label: "Status", get: (i) => statusLabel(i.status) },
  ];
  const { filters: invColFilters, setFilter: setInvColFilter, clearFilters: clearInvFilters, filtered: filteredInvoices, active: invFiltersActive } =
    useColumnFilters(statusFilteredInvoices, invoiceFilterColumns);
  const anyInvoiceFilterActive = filter !== "all" || invFiltersActive;
  const resetInvoiceFilters = () => { setFilter("all"); clearInvFilters(); };

  // Completed and not already on an invoice — the pool available to invoice
  const uninvoicedCompletedJobs = jobs.filter((j: any) => j.status === "completed" && (j._count?.invoiceItems ?? 0) === 0);

  const completedJobs = selectedCustomer
    ? uninvoicedCompletedJobs.filter((j: any) => j.customer?.id === Number(selectedCustomer))
    : [];

  const openInvoiceFor = (job: any) => {
    setSelectedCustomer(String(job.customer?.id || ""));
    setSelectedJobIds([job.id]);
    setShowCreate(true);
  };

  const toggleJob = (id: number) => {
    setSelectedJobIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const validExtras = extraItems
        .filter(item => item.description.trim() && item.unitPrice)
        .map(item => ({
          description: item.description.trim(),
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice),
          vatApplicable: item.vatApplicable,
        }));
      await api.createInvoice({
        customerId: Number(selectedCustomer),
        jobIds: selectedJobIds,
        extraItems: validExtras.length ? validExtras : undefined,
      });
      await refresh();
      setShowCreate(false);
      setSelectedCustomer("");
      setSelectedJobIds([]);
      setExtraItems([]);
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

  const handleApprove = async (id: number) => {
    if (!confirm("Approve this invoice? It will be locked from editing.")) return;
    try {
      await api.approveInvoice(id);
      await refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleReject = async (id: number) => {
    const comment = prompt("Reason for rejecting this invoice (required):");
    if (comment === null) return;
    if (!comment.trim()) { alert("A comment is required to reject an invoice."); return; }
    try {
      await api.rejectInvoice(id, comment.trim());
      await refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleDeleteInvoice = async (id: number, invoiceNumber: string) => {
    if (!confirm(`Delete invoice ${invoiceNumber}? This cannot be undone.`)) return;
    try {
      await api.deleteInvoice(id);
      await refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleDownload = async (invoiceId: number, invoiceNumber: string, format: "docx" | "pdf") => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/${format}`);
      if (!response.ok) throw new Error("Failed to generate document");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert("Error downloading invoice: " + err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} invoices`}
        action={<Btn onClick={() => setShowCreate(true)}>+ Generate Invoice</Btn>}
      />

      {/* Completed jobs not yet on any invoice — surfaced up top so nothing gets missed */}
      {uninvoicedCompletedJobs.length > 0 ? (
        <Card className="p-4 mb-5 border-harvest-200 bg-harvest-50/40">
          <div className="text-sm font-bold uppercase tracking-wider text-harvest-700 mb-2.5">
            Completed, not yet invoiced ({uninvoicedCompletedJobs.length})
          </div>
          <div className="space-y-2">
            {uninvoicedCompletedJobs.map((job: any) => (
              <div key={job.id} className="flex items-center justify-between gap-3 bg-white rounded-lg px-3.5 py-2.5 border border-stone-200">
                <div className="min-w-0">
                  <div className="font-semibold text-base truncate">{job.title}</div>
                  <div className="text-sm text-stone-500 truncate">{job.customer?.name}{fieldNames(job) ? ` · ${fieldNames(job)}` : ""} · {fmtDate(job.plannedDate)}</div>
                </div>
                <button onClick={() => openInvoiceFor(job)} className="flex-shrink-0 px-3 py-2 rounded-lg text-sm font-bold text-harvest-700 bg-harvest-100 hover:bg-harvest-200 transition">
                  Invoice
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-4 mb-5">
          <div className="text-sm text-stone-400">All completed jobs have been invoiced.</div>
        </Card>
      )}

      <div className="flex gap-1.5 mb-5 flex-wrap items-center">
        {["all", "unpaid", "draft", "approved", "sent", "paid"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-base font-semibold transition ${filter === f ? "bg-field-100 text-field-700" : "text-stone-500 hover:bg-stone-100"}`}>
            {f === "all" ? "All" : f === "unpaid" ? "Unpaid" : statusLabel(f)}
          </button>
        ))}
        {anyInvoiceFilterActive && (
          <Btn variant="secondary" onClick={resetInvoiceFilters} className="!px-4 !py-2 !text-base">Reset Filters</Btn>
        )}
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
                <FilterRow columns={invoiceFilterColumns} filters={invColFilters} onChange={setInvColFilter} trailingCells={1} />
              </thead>
              <tbody>
                {filteredInvoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition">
                    <td className="px-4 py-3 font-semibold text-sm font-mono">
                      {inv.invoiceNumber}
                      {inv.status === "draft" && inv.rejectionComment && (
                        <div className="text-[11px] font-normal font-sans text-red-600 mt-0.5 max-w-[220px] whitespace-normal">Rejected: {inv.rejectionComment}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{inv.customer?.name}</td>
                    <td className="px-4 py-3 text-sm">{fmtDate(inv.invoiceDate)}</td>
                    <td className="px-4 py-3 text-sm">{fmtDate(inv.dueDate)}</td>
                    <td className="px-4 py-3 text-sm font-mono">{fmtCurrency(Number(inv.subtotal))}</td>
                    <td className="px-4 py-3 text-sm font-mono">{fmtCurrency(Number(inv.vat))}</td>
                    <td className="px-4 py-3 text-sm font-mono font-semibold">{fmtCurrency(Number(inv.total))}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {inv.status === "draft" && (
                          <>
                            <button onClick={() => openEditInvoice(inv)} className="px-2.5 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition">Edit</button>
                            {inv.createdBy !== currentUser?.id && (
                              <button onClick={() => handleApprove(inv.id)} className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition">Approve</button>
                            )}
                            <button onClick={() => handleReject(inv.id)} className="px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition">Reject</button>
                            <button onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)} className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Delete</button>
                          </>
                        )}
                        {inv.status === "approved" && (
                          <button onClick={() => handleStatusUpdate(inv.id, "sent")} className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition">Send</button>
                        )}
                        {inv.status === "sent" && (
                          <button onClick={() => handleStatusUpdate(inv.id, "paid")} className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition">Mark Paid</button>
                        )}
                        <button onClick={() => handleDownload(inv.id, inv.invoiceNumber, "docx")} className="px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition">Word</button>
                        <button onClick={() => handleDownload(inv.id, inv.invoiceNumber, "pdf")} className="px-2.5 py-1.5 text-xs font-medium text-harvest-700 bg-harvest-50 rounded-lg hover:bg-harvest-100 transition">PDF</button>
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
                    <div className="font-mono font-bold text-lg">{inv.invoiceNumber}</div>
                    <div className="text-base text-stone-500">{inv.customer?.name}</div>
                  </div>
                  <StatusBadge status={inv.status} />
                </div>
                {inv.status === "draft" && inv.rejectionComment && (
                  <div className="text-base text-red-600 mt-1">Rejected: {inv.rejectionComment}</div>
                )}
                <div className="flex justify-between items-center mt-2">
                  <div className="text-base text-stone-400">Due {fmtDate(inv.dueDate)}</div>
                  <div className="font-bold font-mono text-lg">{fmtCurrency(Number(inv.total))}</div>
                </div>
                <div className="flex gap-1.5 flex-wrap mt-3 pt-2 border-t border-stone-100">
                  {inv.status === "draft" && <button onClick={() => openEditInvoice(inv)} className="px-2.5 py-1.5 text-base font-medium text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition">Edit</button>}
                  {inv.status === "draft" && inv.createdBy !== currentUser?.id && (
                    <button onClick={() => handleApprove(inv.id)} className="px-2.5 py-1.5 text-base font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition">Approve</button>
                  )}
                  {inv.status === "draft" && <button onClick={() => handleReject(inv.id)} className="px-2.5 py-1.5 text-base font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition">Reject</button>}
                  {inv.status === "draft" && <button onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)} className="px-2.5 py-1.5 text-base font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Delete</button>}
                  {inv.status === "approved" && <button onClick={() => handleStatusUpdate(inv.id, "sent")} className="px-2.5 py-1.5 text-base font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition">Send</button>}
                  {inv.status === "sent" && <button onClick={() => handleStatusUpdate(inv.id, "paid")} className="px-2.5 py-1.5 text-base font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition">Mark Paid</button>}
                  <button onClick={() => handleDownload(inv.id, inv.invoiceNumber, "docx")} className="px-2.5 py-1.5 text-base font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition">Word</button>
                  <button onClick={() => handleDownload(inv.id, inv.invoiceNumber, "pdf")} className="px-2.5 py-1.5 text-base font-medium text-harvest-700 bg-harvest-50 rounded-lg hover:bg-harvest-100 transition">PDF</button>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className="p-12 text-center">
          <div className="text-stone-400 text-base mb-3">
            {invoices.length === 0 ? "No invoices yet. Generate one from completed jobs." : "No invoices match your filters."}
          </div>
          {anyInvoiceFilterActive && <Btn variant="secondary" onClick={resetInvoiceFilters}>Reset Filters</Btn>}
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
                      <div className="font-semibold text-lg">{job.title}</div>
                      <div className="text-base text-stone-500">{fieldNames(job) ? `${fieldNames(job)} · ` : ""}{job.jobType?.name}</div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-base text-stone-400 py-4 text-center">No completed jobs for this customer</div>
            )}
          </FormField>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold uppercase tracking-wider text-stone-500">Extra Line Items</span>
            <button onClick={addExtraItem} className="text-base text-field-700 font-semibold hover:underline">+ Add Line</button>
          </div>
          {extraItems.length === 0 && (
            <div className="text-base text-stone-400 py-2">No extra lines — <button onClick={addExtraItem} className="underline">add one</button> (e.g. Fuel Levy)</div>
          )}
          {extraItems.map((item, i) => (
            <div key={i} className="mb-3 p-3 rounded-lg border border-stone-200 bg-stone-50 space-y-2">
              <input
                className={inputClass}
                placeholder="Description (e.g. Fuel Levy)"
                value={item.description}
                onChange={e => updateExtraItem(i, "description", e.target.value)}
              />
              <div className="flex gap-2 items-center">
                <input
                  style={{ width: "90px", minWidth: "90px" }}
                  className={inputClass}
                  type="number" step="1" min="1" placeholder="Qty"
                  value={item.quantity}
                  onChange={e => updateExtraItem(i, "quantity", e.target.value)}
                />
                <input
                  style={{ flex: 1 }}
                  className={inputClass}
                  type="number" step="0.01" placeholder="£ Rate"
                  value={item.unitPrice}
                  onChange={e => updateExtraItem(i, "unitPrice", e.target.value)}
                />
                <label className="flex items-center gap-1.5 cursor-pointer select-none flex-shrink-0">
                  <input
                    type="checkbox"
                    className="accent-field-600 w-4 h-4"
                    checked={item.vatApplicable}
                    onChange={e => updateExtraItem(i, "vatApplicable", e.target.checked)}
                  />
                  <span className="text-base text-stone-600 font-medium">VAT</span>
                </label>
                <button onClick={() => removeExtraItem(i)} className="text-stone-400 hover:text-red-500 flex-shrink-0">✕</button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleCreate} disabled={creating || !selectedCustomer || selectedJobIds.length === 0}>
            {creating ? "Generating..." : `Generate Invoice (${selectedJobIds.length} jobs)`}
          </Btn>
        </div>
      </Modal>

      {/* Edit Draft Invoice Modal */}
      <Modal isOpen={!!editingInvoice} onClose={() => setEditingInvoice(null)} title={`Edit ${editingInvoice?.invoiceNumber || ""}`}>
        <div className="mb-3 text-base text-stone-500">Edit line items below. Totals and VAT will be recalculated automatically.</div>
        <div className="space-y-3 max-h-80 overflow-y-auto mb-2">
          {editItems.map((item, i) => (
            <div key={i} className="p-3 rounded-lg border border-stone-200 bg-stone-50 space-y-2">
              <input
                className={inputClass}
                placeholder="Description"
                value={item.description}
                onChange={e => updateEditItem(i, "description", e.target.value)}
              />
              <div className="flex gap-2 items-center">
                <input
                  style={{ width: "90px", minWidth: "90px" }}
                  className={inputClass}
                  type="number" step="1" min="1" placeholder="Qty"
                  value={item.quantity}
                  onChange={e => updateEditItem(i, "quantity", e.target.value)}
                />
                <input
                  style={{ flex: 1 }}
                  className={inputClass}
                  type="number" step="0.01" placeholder="£ Rate"
                  value={item.unitPrice}
                  onChange={e => updateEditItem(i, "unitPrice", e.target.value)}
                />
                <label className="flex items-center gap-1.5 cursor-pointer select-none flex-shrink-0">
                  <input
                    type="checkbox"
                    className="accent-field-600 w-4 h-4"
                    checked={item.vatApplicable}
                    onChange={e => updateEditItem(i, "vatApplicable", e.target.checked)}
                  />
                  <span className="text-base text-stone-600 font-medium">VAT</span>
                </label>
                <button onClick={() => removeEditItem(i)} className="text-stone-400 hover:text-red-500 flex-shrink-0">✕</button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addEditItem} className="text-base text-field-700 font-semibold hover:underline mb-4 block">+ Add Line</button>
        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setEditingInvoice(null)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleEditSave} disabled={editSaving || editItems.length === 0}>
            {editSaving ? "Saving..." : "Save Changes"}
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
  const isAdmin = currentUser?.role === "admin";
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
        action={isAdmin ? <Btn onClick={openCreate}>+ Add Type</Btn> : undefined}
      />

      <div className="space-y-2.5">
        {jobTypes.map((jt: any) => (
          <Card key={jt.id} className="p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-lg">{jt.name}</div>
                <div className="text-base text-stone-500 mt-0.5 flex items-center gap-2">
                  <span>{fmtCurrency(Number(jt.defaultRate))} per {jt.billingUnit}</span>
                  {jt._count?.jobs > 0 && <span>· {jt._count.jobs} jobs</span>}
                  {jt.vatApplicable === false && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-sm font-semibold">No VAT</span>}
                </div>
                {jt.description && <div className="text-base text-stone-400 mt-1">{jt.description}</div>}
              </div>
              {isAdmin && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(jt)} className="px-2.5 py-1.5 text-base font-medium text-field-700 bg-field-50 rounded-lg hover:bg-field-100 transition">Edit</button>
                  <button onClick={() => handleDelete(jt.id, jt.name)} className="px-2.5 py-1.5 text-base font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Delete</button>
                </div>
              )}
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
          <span className="text-base text-stone-700">VAT applicable (20%)</span>
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
  const [nameFilter, setNameFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const filtersActive = !!nameFilter.trim() || typeFilter !== "all" || statusFilter !== "all";
  const clearFilters = () => { setNameFilter(""); setTypeFilter("all"); setStatusFilter("all"); };
  const filteredMachines = machines.filter((m: any) => {
    if (nameFilter.trim() && !m.name.toLowerCase().includes(nameFilter.trim().toLowerCase())) return false;
    if (typeFilter !== "all" && m.machineType !== typeFilter) return false;
    if (statusFilter !== "all" && (statusFilter === "active") !== !!m.active) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Machines"
        subtitle={`${machines.length} machines`}
        action={<Btn onClick={openCreate}>+ Add Machine</Btn>}
      />

      <Card className="p-3 mb-4">
        <div className="flex flex-wrap gap-2.5 items-center">
          <input
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            placeholder="Filter by name..."
            className="px-3 py-2 text-base border border-stone-300 rounded-lg bg-white focus:outline-none focus:border-field-500 focus:ring-2 focus:ring-field-500/20 transition placeholder:text-stone-400 flex-1 min-w-[160px]"
          />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-base border border-stone-300 rounded-lg bg-white focus:outline-none focus:border-field-500 focus:ring-2 focus:ring-field-500/20 transition">
            <option value="all">All types</option>
            {machineTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-base border border-stone-300 rounded-lg bg-white focus:outline-none focus:border-field-500 focus:ring-2 focus:ring-field-500/20 transition">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {filtersActive && (
            <Btn variant="secondary" onClick={clearFilters} className="!px-4 !py-2 !text-base">Reset Filters</Btn>
          )}
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMachines.map((m: any) => (
          <Card key={m.id} className="p-5">
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="font-bold text-lg min-w-0 flex-1 truncate">{m.name}</div>
              <span className={`text-sm font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${m.active ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-500"}`}>
                {m.active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="text-base text-stone-500">{m.machineType}</div>
            <div className="text-base text-stone-400 font-mono mt-0.5">{m.registration || "N/A"}</div>
            {m._count?.jobLogs > 0 && <div className="text-base text-stone-400 mt-2">{m._count.jobLogs} work logs</div>}
            <div className="flex gap-1.5 mt-3 pt-3 border-t border-stone-100">
              <button onClick={() => openEdit(m)} className="px-2.5 py-1.5 text-base font-medium text-field-700 bg-field-50 rounded-lg hover:bg-field-100 transition">Edit</button>
              <button onClick={() => handleToggleActive(m)} className={`px-2.5 py-1.5 text-base font-medium rounded-lg transition ${m.active ? "text-amber-700 bg-amber-50 hover:bg-amber-100" : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"}`}>
                {m.active ? "Deactivate" : "Activate"}
              </button>
              <button onClick={() => handleDelete(m.id, m.name)} className="px-2.5 py-1.5 text-base font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Delete</button>
            </div>
          </Card>
        ))}
        {filteredMachines.length === 0 && (
          <div className="col-span-full text-center py-12">
            <div className="text-stone-400 text-base mb-3">
              {machines.length === 0 ? "No machines yet" : "No machines match your filters"}
            </div>
            {filtersActive && <Btn variant="secondary" onClick={clearFilters}>Reset Filters</Btn>}
          </div>
        )}
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
// DATA TOOLS — bulk CSV import/export (Admin only)
// ============================================================
type ImportResult = {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
};

function DataToolCard({ label, count, columnsHint, exportUrl, importUrl, filename, onImported }: {
  label: string; count: number; columnsHint: string; exportUrl: string; importUrl: string; filename: string;
  onImported: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const response = await fetch(exportUrl);
      if (!response.ok) throw new Error("Failed to export");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError("Error exporting: " + err.message);
    }
    setExporting(false);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const csv = await file.text();
      const res = await fetch(importUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Import failed");
      setResult(json.data);
      if (json.data.created > 0 || json.data.updated > 0) await onImported();
    } catch (err: any) {
      setError("Error importing: " + err.message);
    }
    setImporting(false);
  };

  return (
    <Card className="p-5">
      <div className="flex justify-between items-start gap-3 mb-1">
        <div>
          <h3 className="text-lg font-bold text-stone-900">{label}</h3>
          <p className="text-base text-stone-500 mt-0.5">{count} record{count === 1 ? "" : "s"} · columns: {columnsHint}</p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={handleExport} disabled={exporting}
          className="px-3.5 py-2.5 text-base font-semibold text-field-700 bg-field-50 rounded-lg hover:bg-field-100 disabled:opacity-50 transition">
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
        <button onClick={() => fileInputRef.current?.click()} disabled={importing}
          className="px-3.5 py-2.5 text-base font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition">
          {importing ? "Importing..." : "Import CSV"}
        </button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelected} />
      </div>

      {error && <div className="mt-3 text-base text-red-600">{error}</div>}

      {result && (
        <div className="mt-3 p-3 rounded-lg bg-stone-50 border border-stone-200">
          <div className="text-base font-semibold text-stone-700">
            {result.created} created · {result.updated} updated
            {result.errors.length > 0 && ` · ${result.errors.length} error${result.errors.length === 1 ? "" : "s"}`}
            {result.warnings.length > 0 && ` · ${result.warnings.length} to check`}
          </div>
          {result.warnings.length > 0 && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {result.warnings.map((w, i) => (
                <div key={i} className="text-sm text-amber-600">Row {w.row}: {w.message}</div>
              ))}
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {result.errors.map((e, i) => (
                <div key={i} className="text-sm text-red-600">Row {e.row}: {e.message}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// Editable letterhead — legal name, trade line, address, bank/VAT details —
// used by both the PDF and docx invoice generators instead of being
// hardcoded in code/template. Loads whatever the server currently falls
// back to (real values, even before anything's been saved here), so the
// form is never blank.
function BusinessProfileCard() {
  const blank = { legalName: "", tradeDescription: "", addressLine: "", phone: "", bankSortCode: "", bankAccountNumber: "", vatNumber: "" };
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getBusinessProfile();
        setForm({ ...blank, ...data });
      } catch (err: any) {
        alert("Error loading business profile: " + err.message);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await api.updateBusinessProfile(form);
      setForm({ ...blank, ...data });
      setSavedAt(Date.now());
    } catch (err: any) {
      alert("Error saving business profile: " + err.message);
    }
    setSaving(false);
  };

  return (
    <Card className="p-5 mb-4">
      <div className="mb-4">
        <div className="font-bold text-lg">Business Profile</div>
        <div className="text-base text-stone-500">Your letterhead details — used on every PDF and Word invoice</div>
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <>
          <FormField label="Legal Name" required>
            <input className={inputClass} value={form.legalName} onChange={e => setForm(f => ({ ...f, legalName: e.target.value }))} />
          </FormField>
          <FormField label="Trade Description">
            <input className={inputClass} placeholder="e.g. (Agricultural Contractors)" value={form.tradeDescription} onChange={e => setForm(f => ({ ...f, tradeDescription: e.target.value }))} />
          </FormField>
          <FormField label="Address">
            <textarea className={inputClass} rows={2} placeholder="Street, Town, County, Postcode" value={form.addressLine} onChange={e => setForm(f => ({ ...f, addressLine: e.target.value }))} />
          </FormField>
          <FormField label="Phone">
            <input className={inputClass} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Bank Sort Code">
              <input className={inputClass} placeholder="00-00-00" value={form.bankSortCode} onChange={e => setForm(f => ({ ...f, bankSortCode: e.target.value }))} />
            </FormField>
            <FormField label="Bank Account Number">
              <input className={inputClass} value={form.bankAccountNumber} onChange={e => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="VAT Registration Number">
            <input className={inputClass} value={form.vatNumber} onChange={e => setForm(f => ({ ...f, vatNumber: e.target.value }))} />
          </FormField>
          <div className="flex items-center gap-3 mt-2">
            <Btn onClick={handleSave} disabled={saving || !form.legalName.trim()}>
              {saving ? "Saving..." : "Save Business Profile"}
            </Btn>
            {savedAt && !saving && <span className="text-base text-field-700 font-semibold">Saved</span>}
          </div>
        </>
      )}
    </Card>
  );
}

function DataToolsView() {
  const { customers, jobTypes, machines, refresh } = useApp();

  return (
    <div>
      <PageHeader title="Data Tools" subtitle="Bulk import and export via CSV — admin only" />
      <BusinessProfileCard />
      <div className="space-y-4">
        <DataToolCard
          label="Customers" count={customers.length}
          columnsHint="id, name, contact, phone, email, address"
          exportUrl="/api/customers/export" importUrl="/api/customers/import" filename="customers.csv"
          onImported={refresh}
        />
        <DataToolCard
          label="Job Types" count={jobTypes.length}
          columnsHint="id, name, billingUnit, defaultRate, vatApplicable, description"
          exportUrl="/api/job-types/export" importUrl="/api/job-types/import" filename="job-types.csv"
          onImported={refresh}
        />
        <DataToolCard
          label="Machines" count={machines.length}
          columnsHint="id, name, machineType, registration, active"
          exportUrl="/api/machines/export" importUrl="/api/machines/import" filename="machines.csv"
          onImported={refresh}
        />
      </div>
      <p className="text-base text-stone-400 mt-4">
        Leave the "id" column blank to create a new record. Export first to get a starting template, or to bulk-edit existing data — re-importing it will update matching rows by id and add any new ones.
      </p>
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
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 ${u.role === "admin" ? "bg-harvest-100 text-harvest-700" : u.role === "job_admin" ? "bg-blue-100 text-blue-700" : "bg-field-100 text-field-700"}`}>
          {u.name.split(" ").map((n: string) => n[0]).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-lg truncate">{u.name}</div>
          <div className="text-base text-stone-500 truncate">{u.username ? `@${u.username}` : ""}{u.username && u.email ? " · " : ""}{u.email || ""}{u.phone ? ` · ${u.phone}` : ""}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!u.active && <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">Inactive</span>}
          <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${roleBadgeStyle(u.role)}`}>{roleLabel(u.role)}</span>
          <button onClick={() => openEdit(u)} className="px-2.5 py-1.5 text-base font-medium text-field-700 bg-field-50 rounded-lg hover:bg-field-100 transition">Edit</button>
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
          <div className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-2">Administrators</div>
          <div className="space-y-2">{admins.map(renderUserCard)}</div>
        </div>
      )}

      {jobAdmins.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-2">Job Administrators</div>
          <div className="space-y-2">{jobAdmins.map(renderUserCard)}</div>
        </div>
      )}

      <div>
        <div className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-2">Contractors</div>
        <div className="space-y-2">
          {contractors.map(renderUserCard)}
          {contractors.length === 0 && (
            <Card className="p-8 text-center">
              <div className="text-base text-stone-400">No contractors yet. Add your first team member.</div>
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
        <p className="text-base text-stone-400 -mt-2 mb-4">At least one of username or email is required for login</p>
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
        {error && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-base">{error}</div>}
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
        <p className="text-base text-stone-400 -mt-2 mb-4">At least one of username or email is required for login</p>
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
            <span className="text-base font-medium">Active</span>
          </label>
          {!editForm.active && <span className="text-base text-stone-400">User won't be able to log in</span>}
        </div>
        {editError && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-base">{editError}</div>}
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
// WORK ORDERS
// ============================================================
function WorkOrdersView() {
  const { jobGroups, customers, jobTypes, fields, users, refresh, currentUser } = useApp();
  const [tab, setTab] = useState<"orders" | "templates">("orders");
  const [saving, setSaving] = useState(false);

  // ── Shared form state ──────────────────────────────────────
  const blankForm = () => ({
    name: "", description: "",
    customerId: "", isTemplate: false,
    items: [] as Array<{ jobTypeId: string; sequence: number; notes: string }>,
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(blankForm());

  // ── Apply-template state ───────────────────────────────────
  const [applyingTemplate, setApplyingTemplate] = useState<any>(null);
  const [applyForm, setApplyForm] = useState({
    customerId: "",
    fieldId: "",
    assignedToUserId: "",
    plannedDate: todayStr(),
    overrides: {} as Record<string, { assignedToUserId?: string; plannedDate?: string }>
  });
  const [applying, setApplying] = useState(false);

  const templates = jobGroups.filter((g: any) => g.isTemplate);
  const workOrders = jobGroups.filter((g: any) => !g.isTemplate);
  const displayed = tab === "templates" ? templates : workOrders;

  const customerFields = applyForm.customerId
    ? fields.filter((f: any) => f.customer?.id === Number(applyForm.customerId))
    : [];

  const addItem = () =>
    setForm(f => ({ ...f, items: [...f.items, { jobTypeId: "", sequence: f.items.length + 1, notes: "" }] }));
  const removeItem = (i: number) =>
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, field: string, value: string | number) =>
    setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: value } : item) }));

  const openCreate = (isTemplate: boolean) => {
    setForm({ ...blankForm(), isTemplate });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (g: any) => {
    setForm({
      name: g.name,
      description: g.description || "",
      customerId: g.customer?.id ? String(g.customer.id) : "",
      isTemplate: g.isTemplate,
      items: (g.templateItems || []).map((item: any) => ({
        jobTypeId: String(item.jobTypeId),
        sequence: item.sequence,
        notes: item.notes || "",
      })),
    });
    setEditingId(g.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        isTemplate: form.isTemplate,
        customerId: form.customerId ? Number(form.customerId) : undefined,
        organisationId: (currentUser as any)?.organisationId || 1,
        templateItems: form.items
          .filter(item => item.jobTypeId)
          .map(item => ({ jobTypeId: Number(item.jobTypeId), sequence: item.sequence, notes: item.notes || undefined })),
      };
      if (editingId) {
        await api.updateJobGroup(editingId, { name: payload.name, description: payload.description, templateItems: payload.templateItems });
      } else {
        await api.createJobGroup(payload);
      }
      await refresh();
      setShowForm(false);
    } catch (err: any) { alert("Error: " + err.message); }
    setSaving(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await api.deleteJobGroup(id); await refresh(); }
    catch (err: any) { alert("Error: " + err.message); }
  };

  const handleApply = async () => {
    if (!applyingTemplate) return;
    setApplying(true);
    try {
      // Build overrides for each job type
      const overrides: Record<string, any> = {};
      applyingTemplate.templateItems?.forEach((item: any) => {
        const override = applyForm.overrides[String(item.jobTypeId)] || {};
        overrides[String(item.jobTypeId)] = {
          assignedToUserId: override.assignedToUserId ? Number(override.assignedToUserId) : (applyForm.assignedToUserId ? Number(applyForm.assignedToUserId) : undefined),
          plannedDate: override.plannedDate || applyForm.plannedDate || undefined,
        };
      });

      await api.applyTemplate(applyingTemplate.id, {
        customerId: Number(applyForm.customerId),
        organisationId: (currentUser as any)?.organisationId || 1,
        fieldIds: applyForm.fieldId ? [Number(applyForm.fieldId)] : undefined,
        assignedToUserId: applyForm.assignedToUserId ? Number(applyForm.assignedToUserId) : undefined,
        plannedDate: applyForm.plannedDate || undefined,
        overrides,
      });
      await refresh();
      setApplyingTemplate(null);
      setApplyForm({ customerId: "", fieldId: "", assignedToUserId: "", plannedDate: todayStr(), overrides: {} });
    } catch (err: any) { alert("Error: " + err.message); }
    setApplying(false);
  };

  const statusColour = (status: string) => {
    if (status === "completed") return "bg-emerald-100 text-emerald-700";
    if (status === "cancelled") return "bg-red-50 text-red-600";
    return "bg-field-100 text-field-700";
  };

  return (
    <div>
      <PageHeader
        title="Work Orders"
        subtitle="Group jobs into packages or one-off work orders"
        action={
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => openCreate(true)}>+ Package Template</Btn>
            <Btn onClick={() => openCreate(false)}>+ Work Order</Btn>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5">
        {(["orders", "templates"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-base font-semibold transition ${tab === t ? "bg-field-100 text-field-700" : "text-stone-500 hover:bg-stone-100"}`}>
            {t === "orders" ? `Work Orders (${workOrders.length})` : `Package Templates (${templates.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {displayed.length === 0 && (
          <Card className="p-10 text-center text-stone-400 text-base">
            {tab === "templates"
              ? "No package templates yet. Create one to quickly apply a set of jobs to any customer."
              : "No work orders yet. Create one to group related jobs together."}
          </Card>
        )}
        {displayed.map((g: any) => (
          <Card key={g.id} className="p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg">{g.name}</span>
                  {!g.isTemplate && (
                    <span className={`text-sm font-semibold px-1.5 py-0.5 rounded ${statusColour(g.status)}`}>
                      {g.status}
                    </span>
                  )}
                </div>
                {g.customer && <div className="text-base text-stone-500 mb-1">{g.customer.name}</div>}
                {g.description && <div className="text-base text-stone-400 mb-2">{g.description}</div>}

                {/* Template items */}
                {g.isTemplate && g.templateItems?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {g.templateItems.map((item: any, i: number) => (
                      <span key={item.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 rounded text-base text-stone-600">
                        <span className="text-stone-400">{i + 1}.</span> {item.jobType?.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Work order jobs */}
                {!g.isTemplate && g.jobs?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {g.jobs.map((job: any) => (
                      <div key={job.id} className="flex items-center gap-2 text-base text-stone-600">
                        <StatusBadge status={job.status} />
                        <span>{job.title}</span>
                        {fieldNames(job) && <span className="text-stone-400">· {fieldNames(job)}</span>}
                        {job.assignedTo && <span className="text-stone-400">· {job.assignedTo.name}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-1 flex-shrink-0">
                {g.isTemplate && (
                  <button onClick={() => { setApplyingTemplate(g); setApplyForm({ customerId: "", fieldId: "", assignedToUserId: "", plannedDate: todayStr(), overrides: {} }); }}
                    className="px-2.5 py-1.5 text-base font-medium text-harvest-700 bg-harvest-50 rounded-lg hover:bg-harvest-100 transition">
                    Apply
                  </button>
                )}
                <button onClick={() => openEdit(g)} className="px-2.5 py-1.5 text-base font-medium text-field-700 bg-field-50 rounded-lg hover:bg-field-100 transition">Edit</button>
                <button onClick={() => handleDelete(g.id, g.name)} className="px-2.5 py-1.5 text-base font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Delete</button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Create / Edit Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit" : form.isTemplate ? "New Package Template" : "New Work Order"}>
        <FormField label="Name" required>
          <input className={inputClass} placeholder={form.isTemplate ? "e.g. Full Arable Season" : "e.g. Smith Farm — Spring 2026"} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </FormField>
        {!form.isTemplate && (
          <FormField label="Customer">
            <select className={inputClass} value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
              <option value="">Select customer...</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
        )}
        <FormField label="Description">
          <textarea className={inputClass} rows={2} placeholder="Optional notes..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </FormField>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-base font-semibold text-stone-500 uppercase tracking-wider">
              {form.isTemplate ? "Job Sequence" : "Jobs"}
            </label>
            <button onClick={addItem} className="text-base text-field-700 font-semibold hover:underline">+ Add Job Type</button>
          </div>
          {form.items.length === 0 && (
            <div className="text-base text-stone-400 py-2 text-center border border-dashed border-stone-200 rounded-lg">
              No jobs added yet
            </div>
          )}
          {form.items.map((item, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <span className="text-base text-stone-400 w-5 text-right flex-shrink-0">{i + 1}.</span>
              <select className={`${inputClass} flex-1`} value={item.jobTypeId} onChange={e => updateItem(i, "jobTypeId", e.target.value)}>
                <option value="">Select job type...</option>
                {jobTypes.map((jt: any) => <option key={jt.id} value={jt.id}>{jt.name}</option>)}
              </select>
              <input className={`${inputClass} flex-1`} placeholder="Notes (optional)" value={item.notes} onChange={e => updateItem(i, "notes", e.target.value)} />
              <button onClick={() => removeItem(i)} className="text-stone-400 hover:text-red-500 flex-shrink-0">✕</button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? "Saving..." : editingId ? "Save Changes" : "Create"}
          </Btn>
        </div>
      </Modal>

      {/* Apply Template Modal */}
      <Modal isOpen={!!applyingTemplate} onClose={() => setApplyingTemplate(null)} title={`Apply: ${applyingTemplate?.name || ""}`}>
        <div className="mb-4 text-base text-stone-500">
          This will create a new work order with {applyingTemplate?.templateItems?.length || 0} job{applyingTemplate?.templateItems?.length !== 1 ? "s" : ""} for the selected customer.
        </div>
        <FormField label="Customer" required>
          <select className={inputClass} value={applyForm.customerId} onChange={e => setApplyForm(f => ({ ...f, customerId: e.target.value, fieldId: "" }))}>
            <option value="">Select customer...</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField label="Field (apply to all jobs)">
          <select className={inputClass} value={applyForm.fieldId} onChange={e => setApplyForm(f => ({ ...f, fieldId: e.target.value }))} disabled={!applyForm.customerId}>
            <option value="">{applyForm.customerId ? "None / varies per job" : "Select customer first"}</option>
            {customerFields.map((f: any) => <option key={f.id} value={f.id}>{f.fieldName} ({Number(f.hectares)} ac)</option>)}
          </select>
        </FormField>
        <FormField label="Default Assign To (can override per job)">
          <select className={inputClass} value={applyForm.assignedToUserId} onChange={e => setApplyForm(f => ({ ...f, assignedToUserId: e.target.value }))}>
            <option value="">Unassigned</option>
            {users.filter((u: any) => u.active).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </FormField>
        <FormField label="Default Planned Date (can override per job)">
          <input className={`${inputClass} appearance-none block`} type="date" value={applyForm.plannedDate} onChange={e => setApplyForm(f => ({ ...f, plannedDate: e.target.value }))} />
        </FormField>

        {/* Per-job overrides */}
        {applyingTemplate?.templateItems?.length > 0 && (
          <div className="my-4 p-3 bg-stone-50 rounded-lg border border-stone-200">
            <label className="text-base font-semibold text-stone-500 uppercase tracking-wider mb-3 block">
              Assign Jobs Individually
            </label>
            <div className="space-y-2">
              {applyingTemplate.templateItems.map((item: any, idx: number) => {
                const override = applyForm.overrides[String(item.jobTypeId)] || {};
                const assignedUserId = override.assignedToUserId || applyForm.assignedToUserId;
                return (
                  <div key={item.id} className="flex gap-2 items-end">
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium text-stone-600 mb-1">{idx + 1}. {item.jobType?.name}</div>
                      <select
                        className={inputClass}
                        value={assignedUserId}
                        onChange={e => setApplyForm(f => ({
                          ...f,
                          overrides: {
                            ...f.overrides,
                            [String(item.jobTypeId)]: { ...override, assignedToUserId: e.target.value || undefined }
                          }
                        }))}
                      >
                        <option value="">{applyForm.assignedToUserId ? "(use default)" : "Unassigned"}</option>
                        {users.filter((u: any) => u.active).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <Btn variant="ghost" className="flex-1" onClick={() => setApplyingTemplate(null)}>Cancel</Btn>
          <Btn className="flex-[2]" onClick={handleApply} disabled={applying || !applyForm.customerId}>
            {applying ? "Creating..." : "Create Work Order"}
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
    { id: "work-orders", label: "Work Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4", show: canManageJobs },
    { id: "customers", label: "Customers", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75", show: canManageJobs },
    { id: "invoices", label: "Invoices", icon: "M1 4h22v16H1zM1 10h22", show: isAdmin },
    { id: "job-types", label: "Job Types", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", show: canManageJobs },
    { id: "machines", label: "Machines", icon: "M7 17a3 3 0 100-6 3 3 0 000 6zM19 17a2 2 0 100-4 2 2 0 000 4zM5 17H3V9l4-4h6l3 4h5v8h-2", show: canManageJobs },
    { id: "team", label: "Team", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M20 8v6M23 11h-6", show: isAdmin },
    { id: "data-tools", label: "Data Tools", icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12", show: isAdmin },
  ];
  const visibleLinks = links.filter(l => l.show);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-field-900 text-white hidden lg:flex flex-col z-50">
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="FieldFlow" className="w-10 h-10 rounded-xl object-cover" />
          <div>
            <div className="font-bold text-lg" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>FieldFlow</div>
            <div className="text-sm text-white/40">Farm Contracting</div>
          </div>
        </div>
      </div>
      <nav className="py-3 flex-1">
        {visibleLinks.map(link => (
          <button key={link.id} onClick={() => setView(link.id)}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-base font-medium transition ${currentView === link.id ? "text-white bg-white/10 border-r-[3px] border-harvest-400" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
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
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white/70">
            {session?.user?.name?.split(" ").map((n: string) => n[0]).join("") || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-medium text-white/80 truncate">{session?.user?.name}</div>
            <div className="text-xs text-white/40 capitalize">{session?.user?.role}</div>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition">
          Sign Out
        </button>
      </div>
    </aside>
  );
}

function MobileNav({ currentView, setView, session }: { currentView: ViewId; setView: (v: ViewId) => void; session: any }) {
  const role = session?.user?.role;
  const isAdmin = role === "admin";
  const canManageJobs = role === "admin" || role === "job_admin";
  const tabs: { id: ViewId; label: string; icon: string; show?: boolean }[] = [
    { id: "home", label: "Home", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z", show: true },
    { id: "jobs", label: "Jobs", icon: "M2 7h20v14H2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16", show: true },
    { id: "customers", label: "Customers", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8", show: canManageJobs },
    { id: "invoices", label: "Invoices", icon: "M1 4h22v16H1zM1 10h22", show: isAdmin },
    { id: "data-tools", label: "Data", icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12", show: isAdmin },
  ];
  const visibleTabs = tabs.filter(t => t.show);
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex lg:hidden z-50" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {visibleTabs.map(tab => (
        <button key={tab.id} onClick={() => setView(tab.id)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-sm font-medium transition ${currentView === tab.id ? "text-field-700" : "text-stone-400"}`}>
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
  // Mobile lands on the streamlined Home page; desktop keeps the fuller Dashboard
  const [currentView, setCurrentView] = useState<ViewId>(() =>
    typeof window !== "undefined" && window.innerWidth < 1024 ? "home" : "dashboard"
  );
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
  const [jobGroups, setJobGroups] = useState<any[]>([]);

  const isAdmin = (session?.user as any)?.role === "admin";
  const isJobAdmin = (session?.user as any)?.role === "job_admin";
  const canManageJobs = isAdmin || isJobAdmin; // can see all jobs, create, assign
  const currentUserId = (session?.user as any)?.id;

  const loadAll = useCallback(async () => {
    try {
      const [u, c, f, j, jt, m, i, jg] = await Promise.all([
        api.getUsers(),
        api.getCustomers(),
        api.getFields(),
        api.getJobs(),
        api.getJobTypes(),
        api.getMachines(),
        isAdmin ? api.getInvoices() : Promise.resolve([]), // /api/invoices is admin-only server-side now
        api.getJobGroups(),
      ]);
      setUsers(u);
      setCustomers(c);
      setFields(f);
      // Admin and job_admin see all jobs, contractors only their own
      setJobs(canManageJobs ? j : j.filter((job: any) => job.assignedTo?.id === currentUserId));
      setJobTypes(jt);
      setMachines(m);
      setInvoices(i);
      setJobGroups(jg);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
    setLoading(false);
  }, [canManageJobs, currentUserId, isAdmin]);

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
    setViewFilter(undefined);
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
          <img src="/logo.png" alt="FieldFlow" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3" />
          <div className="text-xl font-bold text-stone-700 mb-2">FieldFlow</div>
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
      case "home": return <MobileHome {...dashboardProps} />;
      case "jobs": return <JobsView onSelectJob={handleSelectJob} initialFilter={viewFilter} />;
      case "job-detail": return selectedJobId ? <JobDetail jobId={selectedJobId} onBack={handleBackToJobs} /> : <JobsView onSelectJob={handleSelectJob} />;
      case "customers": return canManageJobs ? <CustomersView /> : <Dashboard {...dashboardProps} />;
      case "invoices": return isAdmin ? <InvoicesView initialFilter={viewFilter} /> : <Dashboard {...dashboardProps} />;
      case "work-orders": return canManageJobs ? <WorkOrdersView /> : <Dashboard {...dashboardProps} />;
      case "job-types": return canManageJobs ? <JobTypesView /> : <Dashboard {...dashboardProps} />;
      case "machines": return canManageJobs ? <MachinesView /> : <Dashboard {...dashboardProps} />;
      case "team": return isAdmin ? <TeamView /> : <Dashboard {...dashboardProps} />;
      case "data-tools": return isAdmin ? <DataToolsView /> : <Dashboard {...dashboardProps} />;
      default: return <Dashboard {...dashboardProps} />;
    }
  };

  return (
    <AppContext.Provider value={{ users, customers, fields, jobs, jobTypes, machines, invoices, jobGroups, currentUser, loading, refresh: loadAll }}>
      <div className="overflow-x-hidden w-full max-w-[100vw]">
        <Sidebar currentView={currentView} setView={handleSetView} session={session} />
        <MobileNav currentView={currentView} setView={handleSetView} session={session} />

        {/* Offline status & sync queue */}
        <OfflineBar onSynced={loadAll} />

        {/* Mobile header */}
        <header className="sticky top-0 z-40 bg-white border-b border-stone-200 px-4 py-3 flex justify-between items-center lg:hidden">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="FieldFlow" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold">FieldFlow</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg text-stone-500">{session?.user?.name?.split(" ")[0]}</span>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-lg text-stone-400 hover:text-stone-600 transition">
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
