import api from './api';

export interface SignupData {
  email: string;
  full_name: string;
  password?: string;
  phone?: string;
}

export interface OTPVerifyData {
  email: string;
  otp: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user?: {
    id: number;
    email: string;
    full_name: string;
    phone?: string;
    is_verified: boolean;
  };
}

export const authService = {
  // Request OTP for email signup
  async requestOTP(email: string): Promise<{ message: string }> {
    const response = await api.post('/auth/request-otp', { email });
    return response.data;
  },

  // Verify OTP and complete signup
  async verifyOTP(data: OTPVerifyData): Promise<AuthResponse> {
    const response = await api.post('/auth/verify-otp', data);
    return response.data;
  },

  // Phone signup - request OTP
  async requestPhoneOTP(phone: string): Promise<{ message: string }> {
    const response = await api.post('/auth/request-phone-otp', { phone });
    return response.data;
  },

  // Verify phone OTP
  async verifyPhoneOTP(phone: string, otp: string): Promise<AuthResponse> {
    const response = await api.post('/auth/verify-phone-otp', { phone, otp });
    return response.data;
  },

  // Email signup with OTP flow
  async signupEmail(data: {
    email: string;
    full_name: string;
  }): Promise<{ message: string }> {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },

  // Phone signup with OTP flow
  async signupPhone(data: {
    phone: string;
    full_name: string;
  }): Promise<{ message: string }> {
    const response = await api.post('/auth/signup-phone', data);
    return response.data;
  },

  // Login with email/password
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await api.post('/login/access-token', data);
    return response.data;
  },

  // Get current user profile
  async getCurrentUser(): Promise<any> {
    const response = await api.get('/users/me');
    return response.data;
  },

  // Update user profile
  async updateProfile(data: Partial<{
    full_name: string;
    phone: string;
    email: string;
    bio: string;
    avatar_url: string;
  }>): Promise<any> {
    try {
      const response = await api.patch('/users/me', data);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update profile';
      throw new Error(errorMessage);
    }
  },

  // Upload avatar
  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/users/me/avatar', formData);

    return response.data;
  },

  // Change password
  async changePassword(data: {
    old_password: string;
    new_password: string;
  }): Promise<{ message: string }> {
    const response = await api.post('/users/me/change-password', data);
    return response.data;
  },

  // Verify email
  async verifyEmail(data: {
    email: string;
    verification_code: string;
  }): Promise<{ message: string }> {
    const response = await api.post('/users/verify-email', data);
    return response.data;
  },

  // Resend verification email
  async resendVerification(email: string): Promise<{ message: string }> {
    const response = await api.post('/users/resend-verification', { email });
    return response.data;
  },

  // Forgot password
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await api.post('/users/forgot-password', { email });
    return response.data;
  },

  // Reset password
  async resetPassword(data: {
    email: string;
    token: string;
    new_password: string;
  }): Promise<{ message: string }> {
    const response = await api.post('/users/reset-password', data);
    return response.data;
  },
};
