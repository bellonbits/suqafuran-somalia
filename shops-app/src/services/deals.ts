import api from './api';

export interface Deal {
  id: number;
  listing_id: number;
  buyer_id: number;
  seller_id: number;
  outcome: 'pending' | 'bought' | 'not_bought';
  buyer_confirmed: boolean;
  seller_confirmed: boolean;
  buyer_confirmed_at: string | null;
  seller_confirmed_at: string | null;
  created_at: string;
}

export const dealsService = {
  async markPurchased(listingId: number): Promise<Deal> {
    const { data } = await api.post('/deals/mark-purchased', { listing_id: listingId });
    return data;
  },

  async sellerConfirm(dealId: number): Promise<Deal> {
    const { data } = await api.post(`/deals/${dealId}/seller-confirm`);
    return data;
  },

  async sellerDeny(dealId: number): Promise<Deal> {
    const { data } = await api.post(`/deals/${dealId}/seller-deny`);
    return data;
  },

  async getDeal(listingId: number, buyerId: number): Promise<Deal | null> {
    const { data } = await api.get('/deals/', { params: { listing_id: listingId, buyer_id: buyerId } });
    return data;
  },
};

export default dealsService;
