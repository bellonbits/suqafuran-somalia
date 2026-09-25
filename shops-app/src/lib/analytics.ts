/**
 * Thin wrapper around the global Mixpanel snippet (loaded in index.html).
 *
 * Without identify(), every visit is tracked as a fresh anonymous session
 * with no link back to the same person's previous visits or their account
 * -- which is why retention/funnel reports were showing nothing meaningful
 * (just generic autocaptured page views and clicks). This ties real
 * business events to the actual signed-in user.
 */

type MixpanelLike = {
  identify: (id: string) => void;
  reset: () => void;
  track: (event: string, props?: Record<string, unknown>) => void;
  register: (props: Record<string, unknown>) => void;
  people: {
    set: (props: Record<string, unknown>) => void;
    track_charge: (amount: number, props?: Record<string, unknown>) => void;
  };
};

function getMixpanel(): MixpanelLike | null {
  if (typeof window === 'undefined') return null;
  const mp = (window as any).mixpanel;
  if (!mp || typeof mp.track !== 'function') return null;
  return mp;
}

export function identifyUser(user: { id: number | string; full_name?: string; email?: string; phone?: string }) {
  const mp = getMixpanel();
  if (!mp) return;
  mp.identify(String(user.id));
  mp.people.set({
    $name: user.full_name,
    $email: user.email,
    phone: user.phone,
  });
}

export function resetAnalytics() {
  getMixpanel()?.reset();
}

export function trackEvent(event: string, props?: Record<string, unknown>) {
  getMixpanel()?.track(event, props);
}

/**
 * Records a real (self-confirmed, not payment-verified -- Suqafuran doesn't
 * process payment) sale against the current user's profile via Mixpanel's
 * revenue API, so LTV/LTV-CAC reports have something to roll up. Call this
 * alongside trackEvent('Purchase', ...), not instead of it -- track_charge
 * feeds the People/revenue reports, track() feeds the funnel/event reports.
 */
export function trackCharge(amount: number, props?: Record<string, unknown>) {
  getMixpanel()?.people.track_charge(amount, props);
}

/**
 * First-touch acquisition channel, captured once per session (including for
 * anonymous, not-yet-signed-up visitors) so it's attached as a super
 * property to every event this session -- including the eventual Signup
 * Completed/Purchase -- which is what the board's "Top Channels"/"LTV/CAC
 * by channel" reports are built from.
 */
export function captureAcquisitionChannel() {
  const mp = getMixpanel();
  if (!mp) return;

  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');

  let channel = utmSource || 'direct';
  if (!utmSource && typeof document !== 'undefined' && document.referrer) {
    try {
      const referrerHost = new URL(document.referrer).hostname;
      if (referrerHost && referrerHost !== window.location.hostname) {
        channel = referrerHost;
      }
    } catch {
      // Malformed referrer -- fall back to "direct" already set above.
    }
  }

  mp.register({
    acquisition_channel: channel,
    utm_source: utmSource || undefined,
    utm_medium: utmMedium || undefined,
    utm_campaign: utmCampaign || undefined,
  });
}
