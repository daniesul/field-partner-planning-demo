type Gtag = (command: 'event', name: string, params?: Record<string, string | number>) => void;

/**
 * Sends a GA4 event when the gtag snippet from index.html is present.
 * Analytics must never break the demo, so every failure is swallowed.
 */
export function track(name: string, params?: Record<string, string | number>): void {
  try {
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    if (typeof gtag === 'function') gtag('event', name, params);
    // Outreach alerts (public/outreach.js); the busiest tour events stay GA-only.
    const outreach = (window as unknown as { dsOutreach?: (n: string, p?: Record<string, string | number>) => void }).dsOutreach;
    if (typeof outreach === 'function' && name !== 'tour_step' && name !== 'tour_invite_shown') outreach(name, params);
  } catch {
    /* ignore */
  }
}
