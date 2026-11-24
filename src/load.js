import glacierUrl from '../data/massbalance_2025_r2025/massbalance_fixdate_2025_r2025.csv?url';
import cityUrl from '../data/residents_cities_water_usage.csv?url';
import municipalityUrl from '../data/KANTON_ZUERICH_469.csv?url';
import { parseCities, parseGlacierBalances } from './data.js';

async function read(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`CSV request failed (HTTP ${response.status})`);
  return response.text();
}

export async function loadGlaciers() {
  return parseGlacierBalances(await read(glacierUrl));
}

export async function loadCities() {
  const [cities, municipalities] = await Promise.all([read(cityUrl), read(municipalityUrl)]);
  return parseCities(cities, municipalities);
}
