const API_BASE = '/api'

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('procureflow_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let errMessage = 'An error occurred'
    try {
      const errorData = await res.json()
      errMessage = errorData.error || errMessage
    } catch {
      errMessage = res.statusText || errMessage
    }
    throw new Error(errMessage)
  }

  return res.json()
}

export const api = {
  // Auth
  login: (credentials: { email: string; password?: string }) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  getMe: () => request<{ user: any }>('/auth/me'),
  demoSwitch: (role: string) =>
    request<{ token: string; user: any }>('/auth/demo-switch', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),

  // Users
  getUsers: () => request<{ users: any[] }>('/users'),
  createUser: (data: any) =>
    request<{ user: any }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (id: number, data: any) =>
    request<{ user: any }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Departments & Categories
  getDepartments: () => request<{ departments: any[] }>('/departments'),
  createDepartment: (data: any) =>
    request<{ department: any }>('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCategories: () => request<{ categories: any[] }>('/categories'),
  createCategory: (data: any) =>
    request<{ category: any }>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Vendors
  getVendors: () => request<{ vendors: any[] }>('/vendors'),
  getVendorById: (id: number) => request<{ vendor: any }>(`/vendors/${id}`),
  createVendor: (data: any) =>
    request<{ vendor: any }>('/vendors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Purchase Requests
  getPurchaseRequests: (status?: string) =>
    request<{ requests: any[] }>(`/purchase-requests${status ? `?status=${status}` : ''}`),
  getPurchaseRequestById: (id: number) =>
    request<{ request: any }>(`/purchase-requests/${id}`),
  createPurchaseRequest: (data: any) =>
    request<{ request: any }>('/purchase-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePurchaseRequestStatus: (id: number, status: string, remarks?: string) =>
    request<{ request: any }>(`/purchase-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, remarks }),
    }),

  // RFQs & Quotes
  getRfqs: (status?: string) =>
    request<{ rfqs: any[] }>(`/rfqs${status ? `?status=${status}` : ''}`),
  getRfqById: (id: number) => request<{ rfq: any }>(`/rfqs/${id}`),
  createRfq: (data: any) =>
    request<{ rfq: any }>('/rfqs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  submitQuotation: (rfqId: number, data: any) =>
    request<{ quotation: any }>(`/rfqs/${rfqId}/quotes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  recommendQuotation: (quoteId: number, reason: string) =>
    request<{ success: boolean }>(`/rfqs/quotes/${quoteId}/recommend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  returnVendorRecommendation: (rfqId: number, reason: string) =>
    request<{ rfq: any }>(`/rfqs/${rfqId}/return-recommendation`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Purchase Orders
  getPurchaseOrders: (status?: string) =>
    request<{ orders: any[] }>(`/purchase-orders${status ? `?status=${status}` : ''}`),
  getPurchaseOrderById: (id: number) =>
    request<{ order: any }>(`/purchase-orders/${id}`),
  createPurchaseOrder: (data: any) =>
    request<{ order: any }>('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePurchaseOrderStatus: (id: number, data: any) =>
    request<{ order: any }>(`/purchase-orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Goods Receipts
  createGoodsReceipt: (data: any) =>
    request<{ goods_receipt: any }>('/goods-receipts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Invoices & Payments
  getInvoices: (status?: string) =>
    request<{ invoices: any[] }>(`/invoices${status ? `?status=${status}` : ''}`),
  submitInvoice: (data: any) =>
    request<{ invoice: any }>('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  recordPayment: (invoiceId: number, data: any) =>
    request<{ payment: any }>(`/invoices/${invoiceId}/pay`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Notifications & Audit Logs
  getNotifications: () => request<{ notifications: any[] }>('/notifications'),
  markNotificationRead: (id: number) =>
    request<{ success: boolean }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),
  getAuditLogs: () => request<{ logs: any[] }>('/audit-logs'),

  // Analytics
  getDashboardAnalytics: () => request<{ analytics: any }>('/analytics/dashboard'),
}
