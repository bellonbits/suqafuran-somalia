import api from './api';
import type { AlertRule, AlertHistoryItem, AlertStats } from '../store/monitoring/useAlertsStore';

interface ListRulesResponse {
  rules: AlertRule[];
  total: number;
  skip: number;
  limit: number;
}

interface AlertHistoryResponse {
  alerts: AlertHistoryItem[];
  total: number;
  skip: number;
  limit: number;
  hours_lookback: number;
}

interface CreateRuleRequest {
  name: string;
  description?: string;
  metric: string;
  threshold: number;
  comparison_operator: string;
  evaluation_window_minutes?: number;
  aggregation_function?: string;
  metric_filter?: Record<string, any>;
  notification_channel?: string;
  notification_target?: string;
  severity?: string;
}

interface UpdateRuleRequest {
  name?: string;
  description?: string;
  threshold?: number;
  comparison_operator?: string;
  evaluation_window_minutes?: number;
  aggregation_function?: string;
  notification_channel?: string;
  notification_target?: string;
  severity?: string;
  enabled?: boolean;
}

class AlertsService {
  private baseUrl = '/admin/monitoring';

  async listRules(skip: number = 0, limit: number = 25, isActive?: boolean): Promise<ListRulesResponse> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });

    if (isActive !== undefined) {
      params.append('is_active', isActive.toString());
    }

    const response = await api.get<ListRulesResponse>(
      `${this.baseUrl}/alerts/rules?${params.toString()}`
    );

    return response.data;
  }

  async createRule(data: CreateRuleRequest): Promise<{ rule_id: number; message: string }> {
    const response = await api.post(
      `${this.baseUrl}/alerts/rules`,
      data
    );

    return response.data;
  }

  async getRule(ruleId: number): Promise<{ rule: AlertRule; recent_incidents: AlertHistoryItem[] }> {
    const response = await api.get(
      `${this.baseUrl}/alerts/rules/${ruleId}`
    );

    return response.data;
  }

  async updateRule(ruleId: number, data: UpdateRuleRequest): Promise<{ message: string }> {
    const response = await api.patch(
      `${this.baseUrl}/alerts/rules/${ruleId}`,
      data
    );

    return response.data;
  }

  async deleteRule(ruleId: number): Promise<{ message: string }> {
    const response = await api.delete(
      `${this.baseUrl}/alerts/rules/${ruleId}`
    );

    return response.data;
  }

  async getAlertHistory(
    skip: number = 0,
    limit: number = 50,
    hours: number = 24,
    acknowledged?: boolean
  ): Promise<AlertHistoryResponse> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
      hours: hours.toString(),
    });

    if (acknowledged !== undefined) {
      params.append('acknowledged', acknowledged.toString());
    }

    const response = await api.get<AlertHistoryResponse>(
      `${this.baseUrl}/alerts/history?${params.toString()}`
    );

    return response.data;
  }

  async resolveAlert(alertId: number): Promise<{ message: string }> {
    const response = await api.post(
      `${this.baseUrl}/alerts/history/${alertId}/resolve`
    );

    return response.data;
  }

  async getAlertStats(hours: number = 24): Promise<AlertStats> {
    const response = await api.get<AlertStats>(
      `${this.baseUrl}/alerts/stats?hours=${hours}`
    );

    return response.data;
  }
}

export const alertsService = new AlertsService();
