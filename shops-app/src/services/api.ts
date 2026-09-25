import axios from 'axios';
import { useAuthStore } from '@/store/useAuth';
import { useAuthModal } from '@/store/useAuthModal';
import { isCapacitorApp } from '@/lib/capacitor-utils';

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL) ||
  (import.meta.env.VITE_REACT_APP_API_URL) ||
  'https://app.suqafuran.so/api/v1';

const API_ORIGIN = typeof window !== 'undefined'
  ? window.location.origin
  : (import.meta.env.VITE_API_URL?.replace(/\/api\/v1$/, '') || 'https://app.suqafuran.so');

// Some media (e.g. user avatars) is stored on the backend as a path relative
// to the API host rather than a full URL. Resolve it against the API origin
// so it doesn't 404 against whatever origin the frontend happens to be on.
export function resolveMediaUrl(url?: string | null): string | null {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim();
    if (!cleanUrl) return null;
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) return cleanUrl;

    let path = cleanUrl.startsWith('/') ? cleanUrl : '/' + cleanUrl;
    if (path.startsWith('/api/v1')) {
        return `${API_ORIGIN}${path}`;
    }
    if (path.startsWith('/listings/images')) {
        return `${API_ORIGIN}/api/v1${path}`;
    }
    return `${API_ORIGIN}/api/v1/listings/images${path}`;
}

// Optimize Cloudinary URLs for high-quality display
export function optimizeCloudinaryUrl(url?: string | null, options: { width?: number; quality?: 'auto' | number; fetch_format?: 'auto' | 'webp' | 'jpg' } = {}): string | null {
    if (!url || typeof url !== 'string') return null;

    // Only optimize Cloudinary URLs
    if (!url.includes('cloudinary.com')) return url;

    // Animated GIFs break on the fly: f_auto/q_auto/dpr_auto transforms on
    // an animated source can exceed Cloudinary's per-request processing
    // limits (worse at larger widths) and come back as a 400 instead of an
    // image. Serve these untouched rather than guess a safe parameter
    // combination -- they're typically small ad-banner creatives anyway,
    // so there's little to gain from transforming them.
    if (/\.gif($|\?)/i.test(url)) return url;

    const { width = 1920, quality = 'auto', fetch_format = 'auto' } = options;

    // Insert optimization params into Cloudinary URL
    // Format: /image/upload/w_1920,q_auto,f_auto/...
    const parts = url.split('/upload/');
    if (parts.length !== 2) return url;

    const params = [`w_${width}`, `q_${quality}`, `f_${fetch_format}`];
    return `${parts[0]}/upload/${params.join(',')},dpr_auto/${parts[1]}`;
}

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 45000, // Increased to 45s to handle large listings queries
});

api.interceptors.request.use(
    (config) => {
        // Block admin/agent API calls on mobile apps
        const isNativeApp = isCapacitorApp();
        const isAdminRoute = config.url?.includes('/admin/') || config.url?.includes('/agent-dashboard') || config.url?.includes('/admin-dashboard');

        if (isNativeApp && isAdminRoute) {
            console.warn(`Blocked API call to ${config.url} on mobile app`);
            return Promise.reject(new Error('Admin access not allowed on mobile app'));
        }

        try {
            const token = useAuthStore.getState().token;
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (err) {
            console.error('Failed to retrieve auth token:', err);
        }

        // Let browser handle content-type for FormData (multipart/form-data with boundary)
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
            delete config.headers['content-type'];
        }

        if (typeof window !== 'undefined') {
            const fingerprintData = {
                ua: navigator.userAgent,
                scr: `${window.screen.width}x${window.screen.height}`,
                lang: navigator.language,
                tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                plat: navigator.platform,
                hc: navigator.hardwareConcurrency || 'unknown'
            };
            config.headers['X-Device-Fingerprint'] = btoa(JSON.stringify(fingerprintData));
        }

        // CF-Challenge-Bypass for Capacitor/mobile only (browser already handles Sec-Fetch-* automatically)
        if (isCapacitorApp()) {
            config.headers['CF-Challenge-Bypass'] = 'mobile-app';
        }
        config.headers['Accept'] = 'application/json, text/plain, */*';
        config.headers['Accept-Language'] = navigator.language || 'en-US';
        // NOTE: Do NOT set Sec-Fetch-*, Accept-Encoding — these are browser-controlled forbidden headers

        // Override timeout for slow endpoints
        if (config.url?.includes('/listings/upload')) {
            config.timeout = 120000; // 2 minutes for file uploads
        } else if (config.url?.includes('/listings/')) {
            config.timeout = 60000; // 60s for listings queries (database is slow)
        } else if (config.url?.includes('/admin/shops')) {
            config.timeout = config.method === 'put' ? 60000 : 30000; // 60s for PUT (file upload), 30s for GET (first query is slow)
        } else if (config.url?.includes('/shops')) {
            config.timeout = 60000; // 60s for shops detail/listing queries
        }

        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            try {
                const wasAuthenticated = useAuthStore.getState().isAuthenticated;
                // Session already rejected by the server -- nothing to revoke
                useAuthStore.getState().logout(false);
                // Surface the sign-in modal in place rather than yanking the user to a
                // different page and losing whatever they were doing.
                if (wasAuthenticated) {
                    useAuthModal.getState().open('signin');
                }
            } catch (err) {
                console.error('Failed to handle auth error:', err);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
