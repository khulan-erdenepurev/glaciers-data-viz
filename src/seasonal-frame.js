import { Vector3 } from 'three';
import { viewRight } from './camera-framing.js';

const elevation = { right: viewRight, up: new Vector3(0, 1, 0) };

export function seasonalCubeY(slot, size, sign, amount) {
  return sign * ((slot.y * 1.045 + 1) * amount - 0.5) * size;
}

// Project the portion of each live cube that survives clipping at world y = 0.
export function seasonalExtent(slots, amounts, sign, size, { right, up }) {
  const horizontalRadius = size / 2 * (Math.abs(right.x) + Math.abs(right.z));
  const depthRadius = size / 2 * (Math.abs(up.x) + Math.abs(up.z));
  const length = typeof amounts === 'number' ? Math.ceil(amounts) : amounts.length;
  let width = 0, nearest = Infinity, farthest = -Infinity;
  for (let i = 0; i < length; i++) {
    const amount = typeof amounts === 'number' ? Math.min(1, amounts - i) : amounts[i];
    if (amount <= 0) continue;
    const slot = slots[i];
    const x = slot.x * 1.045 * size, z = slot.z * 1.045 * size;
    const y = sign * seasonalCubeY(slot, size, sign, amount);
    const depth = sign * (x * up.x + z * up.z);
    width = Math.max(width, Math.abs(x * right.x + z * right.z) + horizontalRadius);
    nearest = Math.min(nearest, depth - depthRadius + Math.max(0, y - size / 2) * up.y);
    farthest = Math.max(farthest, depth + depthRadius + (y + size / 2) * up.y);
  }
  if (!Number.isFinite(nearest)) return { width: 0, height: 0, dock: 0 };
  return { width, height: farthest - nearest, dock: -nearest };
}

export function seasonalFrame(slots, counts, signs, size, aspect, view = elevation) {
  const extents = counts.map((count, group) => seasonalExtent(slots, count, signs[group], size, view));
  const offsets = [0, 0];
  if (counts.every(count => count > 0) && signs[0] === signs[1]) {
    offsets[0] = -extents[1].width - size / 2;
    offsets[1] = extents[0].width + size / 2;
  }
  const extent = Math.max(...extents.map(({ width, height }, i) =>
    Math.max((Math.abs(offsets[i]) + width) / aspect, height)));
  return { center: new Vector3(), halfHeight: extent * 1.15 + size * 0.55, offsets };
}

export function seasonalDepthShift(extent, sign, depth, up) {
  const projection = depth.dot(up);
  return projection === 0 ? 0 : sign * extent.dock / projection;
}
