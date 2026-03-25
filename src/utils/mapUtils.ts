import { UndiscoveredMessageMapMeta, Coordinates } from '@/types';

/** Parse a location field from Supabase (WKB hex, POINT string, GeoJSON, or plain object). */
export function parseLocationField(location: unknown): Coordinates | null {
  if (!location) return null;
  if (typeof location === 'object') {
    const loc = location as Record<string, unknown>;
    if (loc.type === 'Point' && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      const [lng, lat] = loc.coordinates as number[];
      if (!isNaN(lng) && !isNaN(lat)) return { longitude: lng, latitude: lat };
    }
    if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
      return { longitude: loc.longitude, latitude: loc.latitude };
    }
  }
  if (typeof location === 'string') {
    if (/^[0-9A-Fa-f]+$/.test(location) && location.length >= 42) {
      const coords = parseWKBHex(location);
      if (coords) return coords;
    }
    const match = location.match(/POINT\(([^ ]+) ([^)]+)\)/);
    if (match) {
      const lng = parseFloat(match[1]);
      const lat = parseFloat(match[2]);
      if (!isNaN(lng) && !isNaN(lat)) return { longitude: lng, latitude: lat };
    }
  }
  return null;
}

/** Deterministic palette for avatar background colors. */
const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6',
  '#F59E0B', '#10B981', '#3B82F6', '#EF4444',
];

/** Returns a stable color from a user ID string. */
export function colorForUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Returns 1-2 uppercase initials from a display name. */
export function initialsForName(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

const parseWKBHex = (wkbHex: string): Coordinates | null => {
  try {
    if (wkbHex.length < 42) return null;
    const isLittleEndian = wkbHex.substring(0, 2) === '01';
    const typeHex = wkbHex.substring(2, 10);
    let coordStart = 10;
    if (typeHex === '01000020' || typeHex === '20000001') coordStart = 18;
    const lngHex = wkbHex.substring(coordStart, coordStart + 16);
    const latHex = wkbHex.substring(coordStart + 16, coordStart + 32);
    const hexToDouble = (hex: string, littleEndian: boolean): number => {
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substring(i, i + 2), 16));
      if (littleEndian) bytes.reverse();
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      bytes.forEach((b, i) => view.setUint8(i, b));
      return view.getFloat64(0, false);
    };
    const lng = hexToDouble(lngHex, isLittleEndian);
    const lat = hexToDouble(latHex, isLittleEndian);
    if (!isNaN(lng) && !isNaN(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { longitude: lng, latitude: lat };
  } catch {
    // parse error
  }
  return null;
};

export const getMessageLocation = (message: UndiscoveredMessageMapMeta): Coordinates | null => {
  if (!message.location) return null;
  if (typeof message.location === 'object') {
    const loc = message.location as unknown as Record<string, unknown>;
    if (loc.type === 'Point' && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      const [lng, lat] = loc.coordinates as number[];
      if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) return { longitude: lng, latitude: lat };
    }
    if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number' && !isNaN(loc.latitude as number) && !isNaN(loc.longitude as number)) {
      return { longitude: loc.longitude as number, latitude: loc.latitude as number };
    }
  }
  if (typeof message.location === 'string') {
    if (/^[0-9A-Fa-f]+$/.test(message.location) && message.location.length >= 42) {
      const coords = parseWKBHex(message.location);
      if (coords) return coords;
    }
    const match = message.location.match(/POINT\(([^ ]+) ([^)]+)\)/);
    if (match) {
      const lng = parseFloat(match[1]);
      const lat = parseFloat(match[2]);
      if (!isNaN(lng) && !isNaN(lat)) return { longitude: lng, latitude: lat };
    }
  }
  return null;
};
