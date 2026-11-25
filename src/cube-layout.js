export const maxCubesPerPile = 1600;

export function quantifyVolume(volume, volumePerCube) {
  if (!Number.isFinite(volume) || volume < 0 || !Number.isFinite(volumePerCube) || volumePerCube <= 0) {
    throw new RangeError('Expected nonnegative volume and a positive cube unit');
  }
  const ratio = volume / volumePerCube;
  const nearest = Math.round(ratio);
  const count = Math.abs(ratio - nearest) <= Number.EPSILON * Math.max(1, ratio) * 4
    ? nearest : Math.floor(ratio);
  if (count > maxCubesPerPile) throw new RangeError('Choose a larger cube unit for this volume');
  const represented = count * volumePerCube;
  return { count, represented, remainder: Math.max(0, volume - represented) };
}

export function createPileSlots() {
  const slots = [];
  for (let x = -12; x <= 12; x++) {
    for (let z = -12; z <= 12; z++) {
      // The same offset applies throughout a column so every upper cube has support.
      const noise = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      const offset = noise - Math.floor(noise);
      for (let y = 0; y < 12; y++) {
        const priority = Math.hypot(x * 0.9, z * 1.1) + y * 1.45 + offset * 0.85;
        slots.push({ x, y, z, priority });
      }
    }
  }
  return slots.sort((a, b) => a.priority - b.priority).slice(0, maxCubesPerPile);
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
