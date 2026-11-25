import { Vector3 } from 'three';

// Match the existing view direction, independently of camera distance and zoom.
export const viewDirection = new Vector3(6, 3.1, 9).normalize();
export const viewRight = new Vector3().crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
export const viewUp = new Vector3().crossVectors(viewDirection, viewRight).normalize();

export function pileFrame(slots, count, size, aspect) {
  const radiusX = size / 2 * (Math.abs(viewRight.x) + Math.abs(viewRight.y) + Math.abs(viewRight.z));
  const radiusY = size / 2 * (Math.abs(viewUp.x) + Math.abs(viewUp.y) + Math.abs(viewUp.z));
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const slot of slots.slice(0, count)) {
    const center = new Vector3(slot.x * size * 1.045, slot.y * size * 1.045 + size / 2, slot.z * size * 1.045);
    const x = center.dot(viewRight), y = center.dot(viewUp);
    left = Math.min(left, x - radiusX); right = Math.max(right, x + radiusX);
    bottom = Math.min(bottom, y - radiusY); top = Math.max(top, y + radiusY);
  }
  if (!count) return { center: new Vector3(), halfHeight: 1 };
  return {
    center: viewRight.clone().multiplyScalar((left + right) / 2).addScaledVector(viewUp, (top + bottom) / 2),
    halfHeight: Math.max((right - left) / aspect, top - bottom) / 2,
  };
}

export function mixFrame(from, to, t) {
  return { center: from.center.clone().lerp(to.center, t), halfHeight: from.halfHeight * (to.halfHeight / from.halfHeight) ** t };
}

export function revealProgress(t) {
  const x = Math.max(0, Math.min(1, (t - 0.55) / 0.45));
  return x * x * (3 - 2 * x);
}

export function cityFrame(slots, count, annualCount, size, aspect) {
  const { center, halfHeight } = pileFrame(slots, count, size, aspect);
  const annual = pileFrame(slots, annualCount, size, aspect);
  // Retain period differences and some absolute-scale differences between cities.
  // The additive world-space margin occupies less of the view for larger cities.
  return {
    center,
    halfHeight: Math.max(halfHeight, annual.halfHeight * 0.65) * 1.12 + 20,
  };
}
