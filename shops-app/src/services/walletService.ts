import api from './api';

export const walletService = {
  // Wallet
  async getWallet() {
    const response = await api.get('/wallet');
    return response.data;
  },

  async depositFunds(data: { amount: number; method: string }) {
    const response = await api.post('/wallet/deposit', data);
    return response.data;
  },

  async withdrawFunds(data: { amount: number; method: string }) {
    const response = await api.post('/wallet/withdraw', data);
    return response.data;
  }
};
