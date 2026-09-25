import api from './api';

export const aiService = {
  async generateListingText(title: string, category?: string): Promise<any> {
    try {
      // Backend endpoint expects: { title: string, category?: string, type?: string, target_language?: string }
      // Backend returns: { result: "..." }
      const response = await api.post('/ai/listings/generate', {
        title: title,
        category: category || 'general',
        type: 'description',
        target_language: 'en'
      });

      // Backend wraps response in {result: ...}
      const result = response.data?.result || response.data;
      return result;
    } catch (error: any) {
      console.error('AI generation error:', error.response?.data || error.message);
      throw error;
    }
  },

  async getPriceRecommendation(data: {
    title: string;
    category_id?: number;
    condition?: string;
    description?: string;
  }): Promise<any> {
    try {
      const response = await api.post('/ai/listings/price-recommendation', {
        title: data.title,
        category_id: data.category_id,
        condition: data.condition || 'Used',
        currency: 'KES'
      });
      return response.data;
    } catch (error: any) {
      console.error('Price recommendation error:', error.response?.data || error.message);
      throw error;
    }
  },

  async predictCategory(text: string): Promise<any> {
    try {
      const response = await api.post('/ai/listings/predict-category', {
        title: text,
        description: ''
      });
      return response.data;
    } catch (error: any) {
      console.error('Category prediction error:', error.response?.data || error.message);
      throw error;
    }
  },

  async generateDescription(title: string, category?: string): Promise<{ description: string }> {
    try {
      const result = await this.generateListingText(title, category);
      return { description: typeof result === 'string' ? result : result?.description || '' };
    } catch (error) {
      console.error('Description generation error:', error);
      throw error;
    }
  },

  async getSupportChat(
    messages: { role: string; content: string }[],
    currentListingId?: number,
    ticketId?: number,
    language: string = 'so',
    ticketToken?: string
  ): Promise<any> {
    const response = await api.post('/ai/support/chat', {
      messages,
      current_listing_id: currentListingId,
      ticket_id: ticketId,
      ticket_token: ticketToken,
      language,
    });
    return response.data;
  },
};
