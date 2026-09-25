import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuth';
import type { User } from '@/types';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'seller' | 'admin' | 'agent';
}

// The backend doesn't consistently populate is_admin/is_agent/is_seller on
// every endpoint that returns a user object, so fall back to the generic
// `role` string and an email-keyword heuristic — mirrors the same fallback
// chain Header.tsx already uses for role detection.
function hasRole(user: User, role: 'seller' | 'admin' | 'agent'): boolean {
  const flagKey = `is_${role}` as 'is_seller' | 'is_admin' | 'is_agent';
  if (user[flagKey]) return true;

  const anyUser = user as any;
  if (anyUser.role === role) return true;

  if (user.email?.includes(role)) return true;

  return false;
}

// Admins can access any role-gated area (seller, agent, or admin dashboards)
// — being an admin is a superset of the other dashboard roles.
function isAuthorized(user: User, requiredRole: 'seller' | 'admin' | 'agent'): boolean {
  if (hasRole(user, requiredRole)) return true;
  if (requiredRole !== 'admin' && hasRole(user, 'admin')) return true;
  return false;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Wait for the persisted session to finish loading from storage before
    // deciding to redirect — otherwise an already-logged-in user gets
    // bounced because the store still holds its logged-out default state.
    if (!isHydrated) return;
    if (hasChecked) return;

    if (!isAuthenticated || !user) {
      setHasChecked(true);
      navigate('/login', { replace: true });
      return;
    }

    if (requiredRole && !isAuthorized(user, requiredRole)) {
      setHasChecked(true);
      navigate('/', { replace: true });
      return;
    }

    setHasChecked(true);
  }, [isHydrated, isAuthenticated, user, requiredRole, navigate, hasChecked]);

  if (!isHydrated || !hasChecked) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (requiredRole && !isAuthorized(user, requiredRole)) {
    return null;
  }

  return <>{children}</>;
}
