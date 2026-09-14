import { DEFAULT_IFRS_ACCOUNTS } from './defaultAccounts'

const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'API error')
  }
  return res.json()
}

export const api = {
  // Generic CRUD
  list: async <T = any>(schema: string, limit?: number) => {
    const qs = limit ? `?limit=${limit}` : ''
    try {
      const res = await request<T[]>(`/${schema}${qs}`)
      if (schema === 'Account' && Array.isArray(res) && res.length > 0) {
        return res
      }
      if (schema === 'Account') {
        return DEFAULT_IFRS_ACCOUNTS as unknown as T[]
      }
      return res
    } catch (err) {
      if (schema === 'Account') {
        return DEFAULT_IFRS_ACCOUNTS as unknown as T[]
      }
      throw err
    }
  },
  get: <T = any>(schema: string, name: string) => request<T>(`/${schema}/${encodeURIComponent(name)}`),
  create: <T = any>(schema: string, data: any) => request<T>(`/${schema}`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  }),
  update: <T = any>(schema: string, name: string, data: any) => request<T>(`/${schema}/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  }),
  delete: (schema: string, name: string) => request(`/${schema}/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  }),

  // Actions
  submit: <T = any>(schema: string, name: string) => request<T>(`/${schema}/${encodeURIComponent(name)}/submit`, {
    method: 'POST',
  }),
  cancel: <T = any>(schema: string, name: string) => request<T>(`/${schema}/${encodeURIComponent(name)}/cancel`, {
    method: 'POST',
  }),
  resetToDraft: <T = any>(schema: string, name: string) => request<T>(`/${schema}/${encodeURIComponent(name)}/reset-to-draft`, {
    method: 'POST',
  }),
  getAuditLogs: (schema: string, name: string) => request<any[]>(`/${schema}/${encodeURIComponent(name)}/audit-logs`),
  markPaid: <T = any>(schema: string, name: string) => request<T>(`/${schema}/${encodeURIComponent(name)}/mark-paid`, {
    method: 'POST',
  }),
  markUnpaid: <T = any>(schema: string, name: string) => request<T>(`/${schema}/${encodeURIComponent(name)}/mark-unpaid`, {
    method: 'POST',
  }),

  // Chart of Accounts
  getAccountTree: () => request<any>(`/accounts/tree`),
  getAccountsByRootType: (rootType: string) => request<any[]>(`/accounts/${rootType}`),
  getAccountClassification: (rootType: string) => request<any>(`/accounts/classification/${rootType}`),

  // Reports
  getReport: <T = any>(name: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<T>(`/reports/${name}${qs}`)
  },

  // Approvals & Close
  approveDoc: (name: string) => request<any>(`/approvals/${encodeURIComponent(name)}/approve`, { method: 'POST' }),
  rejectDoc: (name: string) => request<any>(`/approvals/${encodeURIComponent(name)}/reject`, { method: 'POST' }),
  closePeriod: (period: string) => request<any>(`/reports/close-period`, { method: 'POST', body: JSON.stringify({ period }) }),

  // Single values (settings)
  getSingleValue: async (key: string): Promise<string | null> => {
    try {
      const res = await request<{ key: string; value: any }>(`/single-values/${encodeURIComponent(key)}`)
      if (res && typeof res === 'object' && 'value' in res) {
        const val = res.value
        if (typeof val === 'string' && (val === '[object Object]' || val.startsWith('{'))) {
          try {
            const parsed = JSON.parse(val)
            if (parsed && typeof parsed === 'object' && 'value' in parsed) {
              return String(parsed.value ?? '')
            }
          } catch {
            return null
          }
        }
        return String(val ?? '')
      }
      if (typeof res === 'string') {
        return res
      }
      return null
    } catch {
      return null
    }
  },
  setSingleValue: async (key: string, value: string): Promise<void> => {
    const stringValue = typeof value === 'object' ? String((value as any)?.value ?? '') : String(value ?? '')
    await request<void>(`/single-values/${encodeURIComponent(key)}`, {
      method: 'POST',
      body: JSON.stringify({ value: stringValue }),
    })
  },
}
