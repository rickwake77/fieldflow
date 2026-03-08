// src/lib/api-client.ts
// Offline-aware API client for FieldFlow
// - GET requests: try network first, fall back to IndexedDB cache
// - Write requests: try network, queue in IndexedDB if offline
// - Sync queue processes when connectivity returns

import {
  cacheGet,
  cacheSet,
  queueAction,
  isOnline,
  type QueuedAction,
} from "./offline-store";

const BASE = "/api";

// ── Core request ────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Request failed");
  return json.data;
}

// GET with cache fallback
async function cachedGet<T>(cacheKey: string, path: string): Promise<T> {
  try {
    const data = await request<T>(path);
    await cacheSet(cacheKey, data);
    return data;
  } catch (err) {
    const cached = await cacheGet<T>(cacheKey);
    if (cached !== null) return cached;
    throw err;
  }
}

// POST/PATCH/DELETE with offline queue fallback
async function writeRequest<T>(
  path: string,
  method: string,
  body: any,
  queueInfo?: { type: QueuedAction["type"]; description: string }
): Promise<T | { queued: true }> {
  const bodyStr = JSON.stringify(body);

  if (isOnline()) {
    try {
      return await request<T>(path, { method, body: bodyStr });
    } catch (err) {
      if (queueInfo && err instanceof TypeError) {
        await queueAction({
          type: queueInfo.type,
          path,
          method,
          body: bodyStr,
          description: queueInfo.description,
        });
        return { queued: true } as any;
      }
      throw err;
    }
  } else {
    if (queueInfo) {
      await queueAction({
        type: queueInfo.type,
        path,
        method,
        body: bodyStr,
        description: queueInfo.description,
      });
      return { queued: true } as any;
    }
    throw new Error("You are offline. This action cannot be queued.");
  }
}

// ── API Methods ─────────────────────────────────────────────

export const api = {
  // Customers
  getCustomers: () => cachedGet<any[]>("customers", "/customers"),
  getCustomer: (id: number) => cachedGet<any>(`customer-${id}`, `/customers/${id}`),
  createCustomer: (data: any) =>
    request<any>("/customers", { method: "POST", body: JSON.stringify(data) }),
  updateCustomer: (id: number, data: any) =>
    request<any>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCustomer: (id: number) =>
    request<any>(`/customers/${id}`, { method: "DELETE" }),

  // Fields
  getFields: (customerId?: number) =>
    cachedGet<any[]>(
      `fields${customerId ? `-${customerId}` : ""}`,
      `/fields${customerId ? `?customerId=${customerId}` : ""}`
    ),
  createField: (data: any) =>
    request<any>("/fields", { method: "POST", body: JSON.stringify(data) }),
  updateField: (id: number, data: any) =>
    request<any>(`/fields/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteField: (id: number) =>
    request<any>(`/fields/${id}`, { method: "DELETE" }),

  // Jobs
  getJobs: (params?: { status?: string; assignedTo?: number; customerId?: number }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.assignedTo) sp.set("assignedTo", String(params.assignedTo));
    if (params?.customerId) sp.set("customerId", String(params.customerId));
    const qs = sp.toString();
    return cachedGet<any[]>(`jobs-${qs || "all"}`, `/jobs${qs ? `?${qs}` : ""}`);
  },
  getJob: (id: number) => cachedGet<any>(`job-${id}`, `/jobs/${id}`),
  createJob: (data: any) =>
    writeRequest<any>("/jobs", "POST", data, {
      type: "createJob",
      description: `Create job: ${data.title}`,
    }),
  updateJob: (id: number, data: any) =>
    writeRequest<any>(`/jobs/${id}`, "PATCH", data, {
      type: "updateJobStatus",
      description: `Update job #${id}`,
    }),
  deleteJob: (id: number) =>
    request<any>(`/jobs/${id}`, { method: "DELETE" }),

  // Job Logs — the most important offline capability
  getJobLogs: (params?: { jobId?: number; contractorId?: number }) => {
    const sp = new URLSearchParams();
    if (params?.jobId) sp.set("jobId", String(params.jobId));
    if (params?.contractorId) sp.set("contractorId", String(params.contractorId));
    const qs = sp.toString();
    return cachedGet<any[]>(`job-logs-${qs || "all"}`, `/job-logs${qs ? `?${qs}` : ""}`);
  },
  createJobLog: (data: any) =>
    writeRequest<any>("/job-logs", "POST", data, {
      type: "createJobLog",
      description: `Log work: ${data.hoursWorked}hrs on job #${data.jobId}`,
    }),
  updateJobLog: (id: number, data: any) =>
    request<any>(`/job-logs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteJobLog: (id: number) =>
    request<any>(`/job-logs/${id}`, { method: "DELETE" }),

  // Invoices
  getInvoices: () => cachedGet<any[]>("invoices", "/invoices"),
  getInvoice: (id: number) => cachedGet<any>(`invoice-${id}`, `/invoices/${id}`),
  createInvoice: (data: { customerId: number; jobIds: number[]; dueInDays?: number }) =>
    request<any>("/invoices", { method: "POST", body: JSON.stringify(data) }),
  updateInvoice: (id: number, data: any) =>
    request<any>(`/invoices/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteInvoice: (id: number) =>
    request<any>(`/invoices/${id}`, { method: "DELETE" }),

  // Users
  getUsers: () => cachedGet<any[]>("users", "/users"),
  updateUser: (id: number, data: any) =>
    request<any>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Job Types
  getJobTypes: () => cachedGet<any[]>("job-types", "/job-types"),
  createJobType: (data: any) =>
    request<any>("/job-types", { method: "POST", body: JSON.stringify(data) }),
  updateJobType: (id: number, data: any) =>
    request<any>(`/job-types/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteJobType: (id: number) =>
    request<any>(`/job-types/${id}`, { method: "DELETE" }),

  // Machines
  getMachines: () => cachedGet<any[]>("machines", "/machines"),
  createMachine: (data: any) =>
    request<any>("/machines", { method: "POST", body: JSON.stringify(data) }),
  updateMachine: (id: number, data: any) =>
    request<any>(`/machines/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMachine: (id: number) =>
    request<any>(`/machines/${id}`, { method: "DELETE" }),
};
