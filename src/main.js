import './style.css';
import { loadCities, loadGlaciers } from './load.js';
import { glaciers } from './data.js';
import { arenaGlaciers } from './arena-data.js';
import { mountGlacierArena } from './glacier-arena.js';
import { mountWaterStory } from './water-story.js';

const status = document.querySelector('#status');

try {
  const [observations, cities, arenaRecords] = await Promise.all([loadGlaciers(), loadCities(), loadGlaciers(arenaGlaciers)]);
  status.textContent = `Loaded ${observations.length} observations for ${glaciers.length} glaciers and water records for ${cities.length} Swiss municipalities.`;
  mountWaterStory(cities, observations);
  mountGlacierArena(document.querySelector('#arena'), arenaRecords);
} catch (error) {
  status.textContent = `Data could not be loaded. ${error.message}`;
}
