"use client";

import { useEffect, useRef } from 'react';

interface TurnstileProps {
  onToken: (token: string) => void;
  onError?: () => void;
}

export const Turnstile: React.FC<TurnstileProps> = ({ onToken, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const sitekey = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!sitekey) {
      console.error('Turnstile sitekey is not configured. Please set NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY environment variable.');
      return;
    }

    // Prevent multiple renders
    if (renderedRef.current) return;

    const renderTurnstile = () => {
      if (!containerRef.current || renderedRef.current) return;
      if (!(window as any).turnstile) return;

      // Clear previous instances
      containerRef.current.innerHTML = '';

      try {
        (window as any).turnstile.render('#turnstile-container', {
          sitekey: sitekey,
          theme: 'light',
          callback: (token: string) => {
            onToken(token);
          },
          'error-callback': () => {
            onError?.();
          },
        });
        renderedRef.current = true;
      } catch (error) {
        console.warn('Turnstile render error:', error);
      }
    };

    // If script is already loaded
    if ((window as any).turnstile) {
      renderTurnstile();
      return;
    }

    // Check if script is already in DOM
    if (document.querySelector('script[src*="turnstile"]')) {
      return;
    }

    // Load script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      renderTurnstile();
    };

    return () => {
      // Cleanup: remove Turnstile widget on unmount
      if (containerRef.current && (window as any).turnstile?.remove) {
        try {
          (window as any).turnstile.remove('#turnstile-container');
        } catch (e) {
          // Ignore removal errors
        }
      }
      renderedRef.current = false;
    };
  }, [sitekey, onToken, onError]);

  if (!sitekey) {
    return <div className="text-red-500 text-xs p-2 text-center">Verification service not configured</div>;
  }

  return <div id="turnstile-container" ref={containerRef} className="flex justify-center my-4" />;
};
