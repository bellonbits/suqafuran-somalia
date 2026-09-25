import { API_BASE_URL } from './api';
import type {
  TraceDetail,
  TraceSummary,
  CriticalPath,
} from '../store/monitoring/useTracesStore';

interface SearchTracesParams {
  traceId?: string;
  correlationId?: string;
  userId?: number;
  orderId?: string;
  service?: string;
  operation?: string;
  limit?: number;
  lookback?: string;
}

interface SearchTracesResponse {
  traces?: TraceSummary[];
  trace?: TraceDetail;
  total?: number;
  search_params: {
    trace_id: string | null;
    correlation_id: string | null;
    user_id: number | null;
    order_id: string | null;
    service: string | null;
    operation: string | null;
    lookback: string;
  };
  timestamp: string;
}

interface TraceDetailResponse {
  trace: TraceDetail;
  timestamp: string;
}

interface CriticalPathsResponse {
  critical_paths: CriticalPath[];
  timestamp: string;
}

class TracesService {
  private baseUrl = `${API_BASE_URL}/admin/monitoring`;

  async searchTraces(params: SearchTracesParams): Promise<SearchTracesResponse> {
    const queryParams = new URLSearchParams();

    if (params.traceId) queryParams.append('trace_id', params.traceId);
    if (params.correlationId)
      queryParams.append('correlation_id', params.correlationId);
    if (params.userId) queryParams.append('user_id', params.userId.toString());
    if (params.orderId) queryParams.append('order_id', params.orderId);
    if (params.service) queryParams.append('service', params.service);
    if (params.operation) queryParams.append('operation', params.operation);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.lookback) queryParams.append('lookback', params.lookback);

    const response = await fetch(
      `${this.baseUrl}/traces/search?${queryParams.toString()}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to search traces: ${response.statusText}`);
    }

    return response.json();
  }

  async getTraceDetail(traceId: string): Promise<TraceDetailResponse> {
    const response = await fetch(
      `${this.baseUrl}/traces/${traceId}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch trace: ${response.statusText}`);
    }

    return response.json();
  }

  async getCriticalPaths(): Promise<CriticalPathsResponse> {
    const response = await fetch(
      `${this.baseUrl}/traces/critical-paths`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch critical paths: ${response.statusText}`);
    }

    return response.json();
  }
}

export const tracesService = new TracesService();
