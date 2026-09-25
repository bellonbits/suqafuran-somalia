import api from './api';
import type { Shop } from '../store/admin/useShopManagementStore';

interface ListShopsResponse {
  shops: Shop[];
  total: number;
  skip: number;
  limit: number;
}

interface UpdateShopNameResponse {
  success: boolean;
  message: string;
  user_id: number;
  old_name: string;
  new_name: string;
  updated_at: string;
}

class AdminShopService {
  async listShops(
    skip: number = 0,
    limit: number = 25,
    search?: string
  ): Promise<ListShopsResponse> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });

    if (search && search.trim()) {
      params.append('search', search);
    }

    const response = await api.get<ListShopsResponse>(
      `/admin/shops?${params.toString()}`
    );

    return response.data;
  }

  async updateShopName(
    userId: number,
    businessName: string
  ): Promise<UpdateShopNameResponse> {
    const response = await api.patch<UpdateShopNameResponse>(
      `/admin/shops/${userId}/name`,
      {
        business_name: businessName.trim(),
      }
    );

    return response.data;
  }
}

export const adminShopService = new AdminShopService();
