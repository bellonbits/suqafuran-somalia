let scriptLoaded = false;
let scriptLoading = false;
const scriptCallbacks: Array<() => void> = [];

const GOOGLE_MAPS_API_KEY = 'AIzaSyAk6rrT_DxxSanx0pwKjLruI-XhgN_zsko';

export function loadGoogleMapsScript(): Promise<void> {
    return new Promise((resolve) => {
        if (scriptLoaded && window.google?.maps?.places) {
            resolve();
            return;
        }
        scriptCallbacks.push(resolve);
        if (scriptLoading) return;
        scriptLoading = true;
        const s = document.createElement('script');
        s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        s.async = true;
        s.onload = () => {
            scriptLoaded = true;
            scriptLoading = false;
            scriptCallbacks.forEach((cb) => cb());
            scriptCallbacks.length = 0;
        };
        document.head.appendChild(s);
    });
}
