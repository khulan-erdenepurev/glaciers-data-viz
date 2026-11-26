import './style.css';
import { createOrbit } from './orbit.js';
import { loadCities, loadGlaciers } from './load.js';
import { glaciers } from './data.js';
import { arenaGlaciers } from './arena-data.js';
import { mountGlacierArena } from './glacier-arena.js';
import { mountWaterStory } from './water-story.js';

const status = document.querySelector('#status');

try {
  const [observations, cities, arenaRecords] = await Promise.all([loadGlaciers(), loadCities(), loadGlaciers(arenaGlaciers)]);
  status.textContent = `Loaded ${observations.length} observations for ${glaciers.length} glaciers and water records for ${cities.length} Swiss municipalities.`;
  const orbit = createOrbit();
  mountWaterStory(cities, observations, orbit);
  mountGlacierArena(document.querySelector('#arena'), arenaRecords, orbit);
} catch (error) {
  status.textContent = `Data could not be loaded. ${error.message}`;
}
