/**
 * Local DB API client - replaces Supabase. All calls go to the backend.
 * In browser, fallback to same-origin or explicit backend port so API always has a base URL.
 */
function getBaseUrl(): string {
  const env = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_BACKEND_URL : "";
  if (env) return env;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000`;
  }
  return "";
}
const BASE = getBaseUrl();

async function fetchJson<T>(url: string, options?: RequestInit): Promise<{ data: T | null; error: { message: string; details?: string } | null }> {
  try {
    const res = await fetch(url, options);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: { message: json.detail || json.message || "Request failed", details: json.detail } };
    }
    if (json.error) {
      return { data: null, error: { message: json.error, details: json.error } };
    }
    return { data: json.data ?? json, error: null };
  } catch (e: any) {
    return { data: null, error: { message: e?.message || "Network error", details: String(e) } };
  }
}

export async function getPoMasterSiteIds(): Promise<{ data: { route_id_site_id: string }[] | string[]; error: any }> {
  const { data, error } = await fetchJson<string[]>(`${BASE}/api/db/po-master/site-ids`);
  if (error) return { data: [], error };
  return { data: data || [], error: null };
}

export async function getPoMasterBySiteId(routeIdSiteId: string): Promise<{ data: any; error: any }> {
  const { data, error } = await fetchJson<any>(`${BASE}/api/db/po-master?route_id_site_id=${encodeURIComponent(routeIdSiteId)}`);
  return { data: data ?? null, error };
}

export async function getBudgetMasterBySiteId(routeIdSiteId: string, columns?: string[]): Promise<{ data: any; error: any }> {
  const url = `${BASE}/api/db/budget-master?route_id_site_id=${encodeURIComponent(routeIdSiteId)}`;
  const { data, error } = await fetchJson<any>(url);
  return { data: data ?? null, error };
}

export async function getBudgetMasterAllBySiteId(routeIdSiteId: string): Promise<{ data: any[]; error: any }> {
  const url = `${BASE}/api/db/budget-master?route_id_site_id=${encodeURIComponent(routeIdSiteId)}&all=1`;
  const { data, error } = await fetchJson<any[]>(url);
  return { data: Array.isArray(data) ? data : [], error };
}

export async function getBudgetMasterBySurveyIds(surveyIds: string[], columns?: string[]): Promise<{ data: any[]; error: any }> {
  if (!surveyIds?.length) return { data: [], error: null };
  const url = `${BASE}/api/db/budget-master?survey_ids=${encodeURIComponent(surveyIds.join(","))}`;
  const { data, error } = await fetchJson<any[]>(url);
  return { data: Array.isArray(data) ? data : [], error };
}

export async function uploadBudgetMasterRows(rows: any[]): Promise<{ data: null; error: { message: string; details?: string } | null }> {
  const { data, error } = await fetchJson<null>(`${BASE}/api/db/budget-master`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  return { data: null, error };
}

export async function getDnMasterByRouteIdSiteId(routeIdSiteId: string): Promise<{ data: any[]; error: any }> {
  const { data, error } = await fetchJson<any[]>(`${BASE}/api/db/dn-master?route_id_site_id=${encodeURIComponent(routeIdSiteId)}`);
  return { data: Array.isArray(data) ? data : [], error };
}

export async function getDnMasterByDnNumber(dnNumber: string): Promise<{ data: any; error: any }> {
  const { data, error } = await fetchJson<any>(`${BASE}/api/db/dn-master?dn_number=${encodeURIComponent(dnNumber)}`);
  return { data: data ?? null, error };
}

export async function getDnMasterSiteIds(): Promise<{ data: string[]; error: any }> {
  const { data, error } = await fetchJson<string[]>(`${BASE}/api/db/dn-master/site-ids`);
  return { data: Array.isArray(data) ? data : [], error };
}
