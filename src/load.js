import glacierUrl from '../data/massbalance_2025_r2025/massbalance_fixdate_2025_r2025.csv?url';
import waterUrl from '../data/processed/swiss_water_cleaned/swiss_water_observations.csv?url';
import candidatesUrl from '../data/processed/swiss_water_cleaned/swiss_city_comparison_candidates.csv?url';
import populationUrl from '../data/processed/swiss_water_cleaned/swiss_city_population.csv?url';
import { parseGlacierBalances } from './data.js';
import { parseSwissWater } from './swiss-water.js';

async function read(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`CSV request failed (HTTP ${response.status})`);
  return response.text();
}

let glacierSource;
export async function loadGlaciers(selection) {
  glacierSource ??= read(glacierUrl);
  return parseGlacierBalances(await glacierSource, selection);
}

export async function loadCities() {
  const tables = await Promise.all([read(waterUrl), read(candidatesUrl), read(populationUrl)]);
  return parseSwissWater(...tables);
}
