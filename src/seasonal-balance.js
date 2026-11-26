import { waterEquivalentVolume } from './data.js';
import { comparisonVolumePerCube, lossRatio } from './comparison.js';
import { quantifyVolume } from './cube-layout.js';
import { cubeScale } from './scale-transition.js';
import { cityConsumption } from './swiss-water.js';

export const seasonalScale = { ...cubeScale(comparisonVolumePerCube), seasonal: true };

// loadGlaciers returns chronological, unique observations. Ties select the earlier year.
export function nearestObservation(records, year) {
  return records.reduce((best, record) => !best || Math.abs(record.year - year) < Math.abs(best.year - year)
    ? record : best, null);
}

export function seasonalBalance(record) {
  function season(key) {
    const balance = record[key];
    const volume = waterEquivalentVolume(balance, record.area);
    return { balance, volume, cubes: volume === null ? null : quantifyVolume(Math.abs(volume), seasonalScale.volumePerCube) };
  }
  return {
    winter: season('winter'), summer: season('summer'),
    annual: waterEquivalentVolume(record.annual, record.area),
  };
}

export function municipalContext(city, period, signedAnnual) {
  const water = cityConsumption(city, period);
  return { water, ratio: lossRatio(signedAnnual === null ? null : -signedAnnual, water.volumeM3) };
}
