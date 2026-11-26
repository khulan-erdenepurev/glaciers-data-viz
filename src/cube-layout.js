export const maxCubesPerPile = 1600;

export function quantifyVolume(volume, volumePerCube, limit = maxCubesPerPile) {
  if (!Number.isFinite(volume) || volume < 0 || !Number.isFinite(volumePerCube) || volumePerCube <= 0) {
    throw new RangeError('Expected nonnegative volume and a positive cube unit');
  }
  const ratio = volume / volumePerCube;
  const nearest = Math.round(ratio);
  const count = Math.abs(ratio - nearest) <= Number.EPSILON * Math.max(1, ratio) * 4
    ? nearest : Math.floor(ratio);
  if (count > limit) throw new RangeError('Choose a larger cube unit for this volume');
  const represented = count * volumePerCube;
  return { count, represented, remainder: Math.max(0, volume - represented) };
}

export function createPileSlots(limit = maxCubesPerPile) {
  const slots = [];
  const radius = limit > maxCubesPerPile ? 20 : 12;
  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      // The same offset applies throughout a column so every upper cube has support.
      const noise = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      const offset = noise - Math.floor(noise);
      for (let y = 0; y < 12; y++) {
        const priority = Math.hypot(x * 0.9, z * 1.1) + y * 1.45 + offset * 0.85;
        slots.push({ x, y, z, priority });
      }
    }
  }
  slots.sort((a, b) => a.priority - b.priority);
  if (limit <= maxCubesPerPile) return slots.slice(0, limit);

  // Keep the city slot sequence exactly as it was before adding a larger pile.
  const citySlots = slots.filter(({ x, z }) => Math.abs(x) <= 12 && Math.abs(z) <= 12).slice(0, maxCubesPerPile);
  const used = new Set(citySlots);
  return citySlots.concat(slots.filter(slot => !used.has(slot)).slice(0, limit - citySlots.length));
}

export function retargetPile(progress, count, elapsed) {
  const length = Math.max(progress.length, count);
  const next = [];
  for (let index = 0; index < length; index++) {
    const current = progress[index] ?? 0;
    const step = elapsed / (240 + (index % 13) * 14);
    const value = index < count ? Math.min(1, current + step) : Math.max(0, current - step);
    next.push(value);
  }
  while (next.length && next.at(-1) === 0 && next.length > count) next.pop();
  return next;
}

export function pileIsSettled(progress, count) {
  return progress.length === count && progress.every(amount => amount === 1);
}

// Retarget each formation independently, retaining all settled slots in its neighbour.
export function advancePiles(progress, targets, elapsed) {
  return targets.map((count, i) => pileIsSettled(progress[i], count)
    ? progress[i] : retargetPile(progress[i], count, elapsed));
}
