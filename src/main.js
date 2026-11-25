import './style.css';
import { loadCities, loadGlaciers } from './load.js';
import { glaciers } from './data.js';
import { mountWaterStory } from './water-story.js';

const status = document.querySelector('#status');

try {
  const [observations, cities] = await Promise.all([loadGlaciers(), loadCities()]);
  status.textContent = `Loaded ${observations.length} observations for ${glaciers.length} glaciers and water-use estimates for ${cities.length} cities.`;
  mountWaterStory(cities);
} catch (error) {
  status.textContent = `Data could not be loaded. ${error.message}`;
}
