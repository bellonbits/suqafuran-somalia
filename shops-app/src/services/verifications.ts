import api from './api';
import type { VerificationRequest } from '../types';

export const verificationsService = {
    async listRequests(params?: { skip?: number; limit?: number }): Promise<VerificationRequest[]> {
        const { data } = await api.get<VerificationRequest[]>('/verifications/', { params });
        return data;
    },

    async updateStatus(id: number, status: 'approved' | 'rejected'): Promise<VerificationRequest> {
        const { data } = await api.patch<VerificationRequest>(`/verifications/${id}`, { status });
        return data;
    },

    async getMyVerificationStatus(): Promise<VerificationRequest | null> {
        const { data } = await api.get<VerificationRequest | null>('/verifications/me');
        return data;
    },

    async submitVerificationRequest(
        documentType: string,
        idNumber: string,
        tier: 'tier2' | 'premium',
        documentFiles: File[],
        selfieFile: File,
        proofOfAddressFile?: File,
        videoSelfieFile?: File,
        notes?: string
    ): Promise<VerificationRequest> {
        const formData = new FormData();
        formData.append('document_type', documentType);
        formData.append('id_number', idNumber);
        formData.append('tier', tier);

        if (notes) {
            formData.append('notes', notes);
        }

        documentFiles.forEach((file) => {
            formData.append('document_files', file);
        });

        formData.append('selfie_file', selfieFile);

        if (proofOfAddressFile) {
            formData.append('proof_of_address_file', proofOfAddressFile);
        }

        if (videoSelfieFile) {
            formData.append('video_selfie_file', videoSelfieFile);
        }

        const { data } = await api.post<VerificationRequest>('/verifications/apply', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
        });
        return data;
    },
};
