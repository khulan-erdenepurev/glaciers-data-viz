import { waterEquivalentVolume } from './data.js';
import { maxCubesPerPile } from './cube-layout.js';
import { cityCubeScale } from './scale-transition.js';

export function glacierLoss(record) {
  if (!record || !Number.isFinite(record.annual) || !Number.isFinite(record.area)) return null;
  return Math.max(0, -waterEquivalentVolume(record.annual, record.area));
}

export function comparisonScale(annualCityVolume, records) {
  const losses = records.map(glacierLoss).filter(value => value !== null);
  const scale = cityCubeScale(annualCityVolume);
  const limit = Math.max(maxCubesPerPile, Math.ceil(Math.max(0, ...losses) / scale.volumePerCube));
  return { ...scale, limit, comparison: true };
}

export function lossRatio(loss, cityVolume) {
  return loss === null || loss <= 0 || cityVolume <= 0 ? null : loss / cityVolume;
}
