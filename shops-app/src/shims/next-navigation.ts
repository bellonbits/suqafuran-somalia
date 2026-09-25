import { useNavigate, useSearchParams as useRouterSearchParams, useLocation } from 'react-router-dom';

export const useRouter = () => {
  const navigate = useNavigate();
  return {
    push: (path: string) => navigate(path),
    replace: (path: string) => navigate(path, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    prefetch: () => {}, // No-op for compatibility
  };
};

export const useSearchParams = () => {
  const [searchParams] = useRouterSearchParams();
  return searchParams;
};

export const usePathname = () => {
  const location = useLocation();
  return location.pathname;
};
