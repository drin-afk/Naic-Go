/**
 * Loads the Google Maps JavaScript API once. Resolves to window.google.maps,
 * or rejects if no key is configured / the script fails (callers then show the fallback map).
 */
let promise = null;

export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
export const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '';
export const hasGoogleMaps = () => Boolean(GOOGLE_MAPS_KEY);

// Approximate centre of Naic, Cavite — used only to centre the map, not as a terminal location.
export const NAIC_CENTER = { lat: 14.3186, lng: 120.766 };

export function loadGoogleMaps() {
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('Google Maps API key not configured'));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    const cb = `__naicgoMapsReady${Date.now()}`;
    window[cb] = () => { resolve(window.google.maps); delete window[cb]; };
    // Google calls this when the key is invalid / not authorised for this referrer.
    window.gm_authFailure = () => reject(new Error('Google Maps rejected the API key (check key restrictions and billing).'));
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly&callback=${cb}&region=PH&language=en`;
    s.async = true;
    s.defer = true;
    s.onerror = () => { promise = null; reject(new Error('Could not load Google Maps (network error).')); };
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('Google Maps took too long to load.')), 15000);
  });
  return promise;
}

/** External Google Maps link (no API key needed) for directions between two coordinates. */
export function googleMapsDirectionsUrl(from, to, mode = 'transit') {
  if (!to) return null;
  const params = new URLSearchParams({ api: '1', destination: `${to.lat},${to.lng}`, travelmode: mode });
  if (from) params.set('origin', `${from.lat},${from.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
