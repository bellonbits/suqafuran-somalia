import api from './api';

export const imageService = {
  async uploadImage(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/listings/upload', formData);

    return response.data;
  },

  async uploadMultipleImages(files: File[]): Promise<Array<{ url: string; filename: string }>> {
    if (!files || files.length === 0) {
      throw new Error('No files provided for upload');
    }

    const formData = new FormData();
    files.forEach((file) => {
      if (file && file.size > 0) {
        formData.append('files', file, file.name);
      }
    });

    const response = await api.post('/listings/upload-multiple', formData);

    return response.data;
  },

  async uploadVideo(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/listings/upload-video', formData);

    return response.data;
  },
};
