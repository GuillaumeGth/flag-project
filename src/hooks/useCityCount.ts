import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Message } from '@/types';
import { parseLocationField } from '@/utils/mapUtils';

interface CityCountResult {
  cityCount: number;
  cityNames: string[];
}

/**
 * Counts unique cities where messages were posted and returns their names.
 * Uses reverse geocoding on deduplicated coordinates (rounded to ~1km grid).
 */
export function useCityCount(messages: Message[]): CityCountResult {
  const [result, setResult] = useState<CityCountResult>({ cityCount: 0, cityNames: [] });

  useEffect(() => {
    if (messages.length === 0) {
      setResult({ cityCount: 0, cityNames: [] });
      return;
    }

    let cancelled = false;

    async function compute() {
      const seen = new Set<string>();
      const uniqueCoords: { latitude: number; longitude: number }[] = [];

      for (const msg of messages) {
        const loc = parseLocationField(msg.location);
        if (!loc) continue;
        const key = `${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueCoords.push({ latitude: loc.latitude, longitude: loc.longitude });
        }
      }

      if (uniqueCoords.length === 0) {
        setResult({ cityCount: 0, cityNames: [] });
        return;
      }

      const cities = new Set<string>();

      await Promise.all(
        uniqueCoords.map(async (coord) => {
          try {
            const results = await Location.reverseGeocodeAsync(coord);
            const city = results[0]?.city || results[0]?.subregion || results[0]?.region;
            if (city) cities.add(city);
          } catch {
            // ignore geocoding errors for individual coords
          }
        })
      );

      if (!cancelled) {
        const names = Array.from(cities).sort();
        setResult({ cityCount: names.length, cityNames: names });
      }
    }

    compute();
    return () => { cancelled = true; };
  }, [messages]);

  return result;
}
