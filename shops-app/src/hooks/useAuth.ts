import { useState } from 'react';
import { authAPI, SignupPayload, LoginPayload, AuthResponse } from '@/lib/api';

interface User {
  id: string;
  email: string;
  full_name: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signup = async (payload: SignupPayload): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response: AuthResponse = await authAPI.signup(payload);
      const authUser = response.user;

      localStorage.setItem('auth_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(authUser));

      setToken(response.access_token);
      setUser(authUser);

      return true;
    } catch (err: any) {
      const message =
        err.response?.data?.detail ||
        (typeof err.response?.data === 'string' ? err.response.data : 'Signup failed');
      setError(String(message));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const login = async (payload: LoginPayload): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response: AuthResponse = await authAPI.login(payload);
      const authUser = response.user;

      localStorage.setItem('auth_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(authUser));

      setToken(response.access_token);
      setUser(authUser);

      return true;
    } catch (err: any) {
      const message =
        err.response?.data?.detail ||
        (typeof err.response?.data === 'string' ? err.response.data : 'Login failed');
      setError(String(message));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setError(null);
  };

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token && !!user,
    signup,
    login,
    logout,
  };
}
