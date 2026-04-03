// geo-utils.ts (place this in your main process, e.g., src/main/geo-utils.ts)

import { net } from 'electron';

interface Coordinates {
  lat: number;
  long: number;
}

const IP_GEOLOCATION_SERVICES = [
  'https://ipapi.co/json/',          // Primary: good accuracy, generous free tier
  'https://ipinfo.io/json',          // Fallback: reliable, "loc": "lat,long"
  'https://freegeoip.app/json/',     // Backup
  'https://reallyfreegeoip.com/json/', // Additional backup
];

/**
 * Check internet connectivity using a fast, reliable Cloudflare endpoint
 */
const checkInternetConnection = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await net.fetch('https://1.1.1.1/cdn-cgi/trace', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'PlurseApp/1.0',
      },
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.log('Internet connectivity check failed:', error instanceof Error ? error.message : error);
    return false;
  }
};

/**
 * Fetch IP-based coordinates with fallback across multiple free services
 */
const getIPCoordinates = async (): Promise<Coordinates | null> => {
  for (const url of IP_GEOLOCATION_SERVICES) {
    try {
      const response = await net.fetch(url, {
        headers: {
          'User-Agent': 'PlurseApp/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.log(`IP service ${url} responded with status: ${response.status}`);
        continue;
      }

      const data: any = await response.json();

      let lat: number | undefined;
      let long: number | undefined;

      // Parse different API response formats
      if (data.latitude !== undefined && data.longitude !== undefined) {
        lat = Number(data.latitude);
        long = Number(data.longitude);
      } else if (data.loc) {
        // ipinfo.io format: "loc": "40.7128,-74.0060"
        const parts = data.loc.split(',');
        if (parts.length === 2) {
          lat = Number(parts[0].trim());
          long = Number(parts[1].trim());
        }
      }

      // Validate coordinates
      if (lat !== undefined && long !== undefined && !isNaN(lat) && !isNaN(long)) {
        if (lat === 0 && long === 0) {
          console.log(`IP service ${url} returned invalid (0,0) coordinates`);
          continue;
        }
        console.log(`Successfully retrieved coordinates from ${url}: ${lat}, ${long}`);
        return { lat, long };
      } else {
        console.log(`IP service ${url} returned no valid coordinates:`, data);
      }
    } catch (err) {
      console.log(`Failed to fetch from ${url}:`, err instanceof Error ? err.message : err);
      // Continue to next service
    }
  }

  console.error('All IP geolocation services failed or returned invalid data');
  return null;
};

/**
 * Main exported function: Get approximate location via IP (GPS not supported in main process)
 * Use this directly in your ipcMain handler
 */
export const getGeoCoordinates = async (): Promise<Coordinates | null> => {
  console.log('Attempting to determine location via IP geolocation...');

  const online = await checkInternetConnection();
  if (!online) {
    console.log('No internet connection detected – cannot perform IP geolocation');
    return null;
  }

  const coordinates = await getIPCoordinates();

  if (coordinates) {
    console.log(`Auto-geolocation successful: ${coordinates.lat}, ${coordinates.long}`);
    return coordinates;
  } else {
    console.log('Auto-geolocation failed – no coordinates obtained');
    return null;
  }
};
