import api from './api';
import type { SavedAddress } from '../types';

export const addressesService = {
    async list(): Promise<SavedAddress[]> {
        const { data } = await api.get<SavedAddress[]>('/addresses/');
        return data;
    },

    async create(payload: { label: string; formatted_address: string; lat?: number | null; lng?: number | null; is_default?: boolean }): Promise<SavedAddress> {
        const { data } = await api.post<SavedAddress>('/addresses/', payload);
        return data;
    },

    async update(addressId: number, payload: { label?: string; is_default?: boolean }): Promise<SavedAddress> {
        const { data } = await api.patch<SavedAddress>(`/addresses/${addressId}`, payload);
        return data;
    },

    async remove(addressId: number): Promise<void> {
        await api.delete(`/addresses/${addressId}`);
    },
};
