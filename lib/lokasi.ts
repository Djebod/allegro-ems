/** Perhitungan jarak dua titik koordinat (meter), rumus haversine. */
export function jarakMeter(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Menerima "-6.7320, 108.5523" atau tautan Google Maps yang mengandung
 * "@-6.7320,108.5523" maupun "?q=-6.7320,108.5523".
 */
export function bacaKoordinat(teks: string): { lat: number; lng: number } | null {
  const cocok = teks.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (!cocok) return null;
  const lat = Number(cocok[1]);
  const lng = Number(cocok[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
