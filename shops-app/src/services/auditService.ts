import api from './api';

export interface AuditLog {
  id: number;
  action: string;
  user_id: number;
  full_name: string;
  email: string;
  phone?: string;
  details?: string;
  created_at: string;
}

export const auditService = {
  async getLogs(params?: { limit?: number; offset?: number }) {
    const response = await api.get('/audit-logs', { params });
    return response.data;
  }
};
