import api from './api';

export interface MonitoringOverview {
  stats: {
    events_per_sec: number;
    notification_success_rate: number;
    active_workers: number;
    queue_depth: number;
    p95_latency_ms: number;
    failed_payments_1h: number;
    open_alerts: number;
  };
  topic_health: Array<{
    name: string;
    messages_per_sec: number;
    consumer_lag: number;
    partition_count: number;
    status: string;
    last_message_timestamp: string | null;
  }>;
  summary: {
    total_topics: number;
    lagging_topics: number;
    stalled_topics: number;
  };
  timestamp: string;
}

export interface KafkaTopic {
  name: string;
  partition_count: number;
  total_messages: number;
  messages_per_sec: number;
  consumer_lag: number;
  consumer_groups: string[];
  retention_bytes: number | null;
  retention_ms: number | null;
  status: string;
  last_message_timestamp: string | null;
}

export interface KafkaTopicsResponse {
  topics: KafkaTopic[];
  total: number;
  timestamp: string;
}

export interface KafkaTopicDetail {
  topic: {
    name: string;
    partition_count: number;
    total_messages: number;
    messages_per_sec: number;
    consumer_lag: number;
    status: string;
    retention_bytes: number | null;
    retention_ms: number | null;
  };
  partitions: Array<{
    id: number;
    leader: number;
    log_end_offset: number;
    committed_offset: number;
    lag: number;
  }>;
  time_series: {
    throughput_1h: any[];
    lag_1h: any[];
  };
  timestamp: string;
}

class MonitoringService {
  /**
   * Get monitoring dashboard overview
   */
  async getOverview(): Promise<MonitoringOverview> {
    const response = await api.get('/admin/monitoring/overview');
    return response.data;
  }

  /**
   * Get list of all Kafka topics with metrics
   */
  async getKafkaTopics(): Promise<KafkaTopicsResponse> {
    const response = await api.get('/admin/monitoring/kafka/topics');
    return response.data;
  }

  /**
   * Get detailed metrics for a specific Kafka topic
   */
  async getKafkaTopicDetail(topicName: string): Promise<KafkaTopicDetail> {
    const response = await api.get(
      `/admin/monitoring/kafka/topics/${encodeURIComponent(topicName)}`
    );
    return response.data;
  }

  /**
   * Get recent messages from a Kafka topic
   */
  async getKafkaTopicMessages(
    topicName: string,
    skip: number = 0,
    limit: number = 50,
    eventTypeFilter?: string,
    statusFilter?: string
  ): Promise<any> {
    const params = new URLSearchParams();
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    if (eventTypeFilter) params.append('event_type_filter', eventTypeFilter);
    if (statusFilter) params.append('status_filter', statusFilter);

    const response = await api.get(
      `/admin/monitoring/kafka/topics/${encodeURIComponent(
        topicName
      )}/messages?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get notification funnel data grouped by event type
   */
  async getNotificationFunnel(params?: {
    dateFrom?: string;
    dateTo?: string;
    channel?: string;
    eventType?: string;
  }): Promise<any> {
    const response = await api.get('/admin/monitoring/notifications/funnel', {
      params,
    });
    return response.data;
  }

  /**
   * Get notification delivery summary (table view)
   */
  async getNotificationSummary(params?: {
    dateFrom?: string;
    dateTo?: string;
    channel?: string;
  }): Promise<any> {
    const response = await api.get('/admin/monitoring/notifications/summary', {
      params,
    });
    return response.data;
  }

  /**
   * Get paginated notification delivery events/attempts
   */
  async getNotificationEvents(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    eventType?: string;
    channel?: string;
    userId?: number;
  }): Promise<any> {
    const response = await api.get('/admin/monitoring/notifications/events', {
      params,
    });
    return response.data;
  }

  /**
   * Retry a failed notification
   */
  async retryNotification(notificationId: string): Promise<any> {
    const response = await api.post(
      `/admin/monitoring/notifications/${encodeURIComponent(notificationId)}/retry`
    );
    return response.data;
  }

  /**
   * Search traces (Phase 3)
   */
  async searchTraces(query: string): Promise<any> {
    const response = await api.get('/admin/monitoring/traces/search', {
      params: { q: query },
    });
    return response.data;
  }

  /**
   * Get live events (Phase 4)
   */
  async getLiveEvents(): Promise<any> {
    const response = await api.get('/admin/monitoring/live');
    return response.data;
  }

  /**
   * Get alerts (Phase 5)
   */
  async getAlerts(): Promise<any> {
    const response = await api.get('/admin/monitoring/alerts');
    return response.data;
  }
}

export const monitoringService = new MonitoringService();
