import { Vector3 } from 'three';
import { viewRight } from './camera-framing.js';

// A level orthographic elevation keeps the base of every column on the zero line.
// The sideways view still exposes two faces of each cube.
export const seasonalDirection = new Vector3(-viewRight.z, 0, viewRight.x);

export function seasonalFrame(slots, counts, signs, size, aspect) {
  const extents = counts.map(count => {
    let width = 0, height = 0;
    const radius = size / 2 * (Math.abs(viewRight.x) + Math.abs(viewRight.z));
    for (let i = 0; i < count; i++) {
      const { x, y, z } = slots[i];
      width = Math.max(width, Math.abs(x * viewRight.x + z * viewRight.z) * size * 1.045 + radius);
      height = Math.max(height, (y * 1.045 + 1) * size);
    }
    return { width, height };
  });
  const offsets = [0, 0];
  if (counts.every(count => count > 0) && signs[0] === signs[1]) {
    offsets[0] = -extents[1].width - size / 2;
    offsets[1] = extents[0].width + size / 2;
  }
  const extent = Math.max(...extents.map(({ width, height }, i) =>
    Math.max((Math.abs(offsets[i]) + width) / aspect, height)));
  return { center: new Vector3(), halfHeight: extent * 1.15 + size * 0.55, offsets };
}
