import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    // Skip retry for auth endpoints themselves to avoid loops
    const isAuthEndpoint = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem('token', data.token);
          localStorage.setItem('refreshToken', data.refreshToken);
          original.headers.Authorization = `Bearer ${data.token}`;
          return api(original);
        } catch {
          // Refresh failed — clear everything and redirect
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('auth-store');
          window.location.replace('/login');
        }
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('auth-store');
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (data: any) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  profile: () => api.get('/auth/profile'),
  setup2FA: () => api.post('/auth/2fa/setup'),
  verify2FA: (totpCode: string) => api.post('/auth/2fa/verify', { totpCode }),
};

// Contacts
export const contactsApi = {
  list: (params?: any) => api.get('/contacts', { params }),
  get: (id: string) => api.get(`/contacts/${id}`),
  create: (data: any) => api.post('/contacts', data),
  update: (id: string, data: any) => api.put(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  bulkImport: (contacts: any[]) => api.post('/contacts/bulk-import', { contacts }),
  merge: (primaryId: string, duplicateId: string) => api.post('/contacts/merge', { primaryId, duplicateId }),
  groups: () => api.get('/contacts/groups'),
  createGroup: (data: any) => api.post('/contacts/groups', data),
};

// Leads
export const leadsApi = {
  list: (params?: any) => api.get('/leads', { params }),
  get: (id: string) => api.get(`/leads/${id}`),
  create: (data: any) => api.post('/leads', data),
  update: (id: string, data: any) => api.put(`/leads/${id}`, data),
  convert: (id: string, data: any) => api.post(`/leads/${id}/convert`, data),
  bulkAssign: (data: any) => api.post('/leads/bulk-assign', data),
};

// Deals
export const dealsApi = {
  list: (params?: any) => api.get('/deals', { params }),
  create: (data: any) => api.post('/deals', data),
  update: (id: string, data: any) => api.put(`/deals/${id}`, data),
  updateStage: (id: string, stageId: string) => api.patch(`/deals/${id}/stage`, { stageId }),
  delete: (id: string) => api.delete(`/deals/${id}`),
};

// Pipelines
export const pipelinesApi = {
  list: () => api.get('/pipelines'),
  create: (data: any) => api.post('/pipelines', data),
  addStage: (pipelineId: string, data: any) => api.post(`/pipelines/${pipelineId}/stages`, data),
  updateStage: (stageId: string, data: any) => api.put(`/pipelines/stages/${stageId}`, data),
};

// Conversations
export const conversationsApi = {
  list: (params?: any) => api.get('/conversations', { params }),
  get: (id: string) => api.get(`/conversations/${id}`),
  assign: (id: string, data: any) => api.patch(`/conversations/${id}/assign`, data),
  updateStatus: (id: string, status: string) => api.patch(`/conversations/${id}/status`, { status }),
  toggleBot: (id: string, botPaused: boolean) => api.patch(`/conversations/${id}/bot`, { botPaused }),
  messages: (id: string, params?: any) => api.get(`/conversations/${id}/messages`, { params }),
  sendMessage: (id: string, data: any) => api.post(`/conversations/${id}/messages`, data),
  deleteMessageForMe: (conversationId: string, messageId: string) =>
    api.post(`/conversations/${conversationId}/messages/${messageId}/delete-for-me`),
  deleteMessageForEveryone: (conversationId: string, messageId: string) =>
    api.post(`/conversations/${conversationId}/messages/${messageId}/delete-for-everyone`),
  addNote: (id: string, content: string) => api.post(`/conversations/${id}/notes`, { content }),
};

// Broadcasts
export const broadcastsApi = {
  list: (params?: any) => api.get('/broadcasts', { params }),
  create: (data: any) => api.post('/broadcasts', data),
  launch: (id: string) => api.post(`/broadcasts/${id}/launch`),
  pause: (id: string) => api.post(`/broadcasts/${id}/pause`),
  stats: (id: string) => api.get(`/broadcasts/${id}/stats`),
};

// WhatsApp
export const whatsappApi = {
  accounts: () => api.get('/whatsapp/accounts'),
  createAccount: (data: any) => api.post('/whatsapp/accounts', data),
  templates: () => api.get('/whatsapp/templates'),
  createTemplate: (data: any) => api.post('/whatsapp/templates', data),
  submitTemplate: (id: string) => api.post(`/whatsapp/templates/${id}/submit`),
};

// Analytics
export const analyticsApi = {
  dashboard: (params?: any) => api.get('/analytics/dashboard', { params }),
  funnel: () => api.get('/analytics/funnel'),
  agents: () => api.get('/analytics/agents'),
  leadsBySource: () => api.get('/analytics/leads-by-source'),
  revenue: () => api.get('/analytics/revenue'),
  messages: (params?: any) => api.get('/analytics/messages', { params }),
};

// AI
export const aiApi = {
  generateReply: (conversationId: string, userMessage: string) =>
    api.post('/ai/reply', { conversationId, userMessage }),
  summarize: (conversationId: string) => api.post(`/ai/conversations/${conversationId}/summarize`),
  scoreLeadAI: (leadId: string) => api.post(`/ai/leads/${leadId}/score`),
  translate: (text: string, targetLanguage: string) => api.post('/ai/translate', { text, targetLanguage }),
  generateTemplate: (data: any) => api.post('/ai/generate-template', data),
  smartRouting: (conversationId: string) => api.post('/ai/smart-routing', { conversationId }),
};

// Automations
export const automationsApi = {
  list: () => api.get('/automations'),
  get: (id: string) => api.get(`/automations/${id}`),
  create: (data: any) => api.post('/automations', data),
  update: (id: string, data: any) => api.put(`/automations/${id}`, data),
  toggle: (id: string) => api.patch(`/automations/${id}/toggle`),
  delete: (id: string) => api.delete(`/automations/${id}`),
};

// Campaigns
export const campaignsApi = {
  list: () => api.get('/campaigns'),
  create: (data: any) => api.post('/campaigns', data),
  update: (id: string, data: any) => api.put(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
};

// Tags
export const tagsApi = {
  list: () => api.get('/tags'),
  create: (data: any) => api.post('/tags', data),
  delete: (id: string) => api.delete(`/tags/${id}`),
};

// Users & Teams
export const usersApi = {
  list: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  deactivate: (id: string) => api.delete(`/users/${id}`),
};

export const teamsApi = {
  list: () => api.get('/teams'),
  create: (data: any) => api.post('/teams', data),
  update: (id: string, data: any) => api.put(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
};

// Products & Orders
export const productsApi = {
  list: (params?: any) => api.get('/products', { params }),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

export const ordersApi = {
  list: (params?: any) => api.get('/orders', { params }),
  create: (data: any) => api.post('/orders', data),
  update: (id: string, data: any) => api.put(`/orders/${id}`, data),
};

// Tickets
export const ticketsApi = {
  list: (params?: any) => api.get('/tickets', { params }),
  create: (data: any) => api.post('/tickets', data),
  update: (id: string, data: any) => api.put(`/tickets/${id}`, data),
  submitCsat: (id: string, data: any) => api.post(`/tickets/${id}/csat`, data),
};

// Knowledge Base
export const kbApi = {
  list: (params?: any) => api.get('/knowledge-base', { params }),
  create: (data: any) => api.post('/knowledge-base', data),
  update: (id: string, data: any) => api.put(`/knowledge-base/${id}`, data),
  delete: (id: string) => api.delete(`/knowledge-base/${id}`),
};

// Organization
export const orgApi = {
  current: () => api.get('/organizations/current'),
  update: (data: any) => api.put('/organizations/current', data),
  customFields: () => api.get('/organizations/custom-fields'),
  createCustomField: (data: any) => api.post('/organizations/custom-fields', data),
};

// QR Codes
export const qrApi = {
  list: () => api.get('/qr-codes'),
  create: (data: any) => api.post('/qr-codes', data),
  delete: (id: string) => api.delete(`/qr-codes/${id}`),
};
