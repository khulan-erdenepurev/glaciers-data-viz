import { waterEquivalentVolume } from './data.js';
import { maxCubesPerPile } from './cube-layout.js';
import { cubeScale } from './scale-transition.js';

export function glacierLoss(record) {
  if (!record || !Number.isFinite(record.annual) || !Number.isFinite(record.area)) return null;
  return Math.max(0, -waterEquivalentVolume(record.annual, record.area));
}

// A single unit keeps the smallest city estimate visible within the instance budget.
export const comparisonVolumePerCube = 500_000;

export function comparisonScale(annualCityVolumes, records) {
  const losses = records.map(glacierLoss).filter(value => value !== null);
  const scale = cubeScale(comparisonVolumePerCube);
  const largest = Math.max(...annualCityVolumes, ...losses);
  const limit = Math.max(maxCubesPerPile, Math.ceil(largest / scale.volumePerCube));
  return { ...scale, limit, comparison: true };
}

export function lossRatio(loss, cityVolume) {
  return loss === null || loss <= 0 || cityVolume <= 0 ? null : loss / cityVolume;
}
