import { maxCubesPerPile } from './cube-layout.js';

export const individualUnit = 0.262;
export const apartmentUnit = 20;

export function cubeScale(volumePerCube, zoom = 1) {
  return { volumePerCube, edgeRatio: Math.cbrt(volumePerCube / individualUnit), zoom };
}

export function cityCubeScale(annualVolume) {
  const grouping = Math.max(1, Math.ceil(Math.cbrt(annualVolume / (apartmentUnit * maxCubesPerPile))));
  const scale = cubeScale(apartmentUnit * grouping ** 3, apartmentScale.zoom * grouping * 0.67);
  return { ...scale, fitCity: true, annualCount: Math.floor(annualVolume / scale.volumePerCube) };
}

export const apartmentScale = cubeScale(apartmentUnit, 2.05);

export function scaleTransition(progress, destinationCount, fromZoom, toZoom) {
  const t = Math.max(0, Math.min(1, progress));
  const ease = t * t * (3 - 2 * t);
  const rise = (start, end) => Math.max(0, Math.min(1, (t - start) / (end - start)));
  return {
    zoom: fromZoom * (toZoom / fromZoom) ** ease,
    sourceWeight: 1 - rise(0.49, 0.83),
    groupingOpacity: rise(0.22, 0.37) * (1 - rise(0.70, 0.85)),
    growth: destinationCount * rise(0.32, 1),
  };
}

// Data changes can continue while scroll independently changes the LOD reveal.
export function advanceTransitionCounts(current, target, elapsed) {
  const amount = 1 - Math.exp(-Math.max(0, elapsed) / 140);
  const approach = (value, destination) => Math.abs(destination - value) < 0.001
    ? destination : value + (destination - value) * amount;
  return {
    sourceCount: approach(current.sourceCount, target.sourceCount),
    destinationCount: approach(current.destinationCount, target.destinationCount),
  };
}
