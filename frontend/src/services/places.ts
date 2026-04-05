const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export interface PlaceSuggestion {
  id: string;
  address: string;
  lat: number;
  lng: number;
}

interface GeocodeResponse {
  status?: string;
  results?: {
    place_id?: string;
    formatted_address?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }[];
}

const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

// Calculate distance between two coordinates (km)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function searchAddressSuggestions(
  query: string,
  limit: number = 5,
  userLat?: number,
  userLng?: number
): Promise<PlaceSuggestion[]> {
  const normalized = query.trim();
  if (normalized.length < 3 || !GOOGLE_MAPS_API_KEY) {
    return [];
  }

  const endpoint = `${GEOCODE_BASE}?address=${encodeURIComponent(normalized)}&key=${encodeURIComponent(
    GOOGLE_MAPS_API_KEY
  )}&language=pt-BR&region=br`;

  const response = await fetch(endpoint);
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as GeocodeResponse;
  if (payload.status !== 'OK' || !payload.results?.length) {
    return [];
  }

  const results = payload.results
    .map((item, index) => {
      const lat = item.geometry?.location?.lat;
      const lng = item.geometry?.location?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return null;
      }

      return {
        id: item.place_id || `${item.formatted_address || 'resultado'}-${index}`,
        address: item.formatted_address || normalized,
        lat,
        lng,
        distance: userLat && userLng ? calculateDistance(userLat, userLng, lat, lng) : Infinity,
      } as PlaceSuggestion & { distance: number };
    })
    .filter((item): item is PlaceSuggestion & { distance: number } => Boolean(item));

  // Sort by proximity if user location provided
  if (userLat && userLng) {
    results.sort((a, b) => a.distance - b.distance);
  }

  // Remove distance field for return
  return results.slice(0, limit).map(({ distance, ...rest }) => rest);
}
