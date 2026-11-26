import { Vector3 } from 'three';

// Match the existing view direction, independently of camera distance and zoom.
export const viewDirection = new Vector3(6, 3.1, 9).normalize();
export const viewRight = new Vector3().crossVectors(new Vector3(0, 1, 0), viewDirection).normalize();
export const viewUp = new Vector3().crossVectors(viewDirection, viewRight).normalize();

export function pileFrame(slots, count, size, aspect, { right: horizontal = viewRight, up: vertical = viewUp } = {}) {
  const radiusX = size / 2 * (Math.abs(horizontal.x) + Math.abs(horizontal.y) + Math.abs(horizontal.z));
  const radiusY = size / 2 * (Math.abs(vertical.x) + Math.abs(vertical.y) + Math.abs(vertical.z));
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const slot of slots.slice(0, count)) {
    const center = new Vector3(slot.x * size * 1.045, slot.y * size * 1.045 + size / 2, slot.z * size * 1.045);
    const x = center.dot(horizontal), y = center.dot(vertical);
    left = Math.min(left, x - radiusX); right = Math.max(right, x + radiusX);
    bottom = Math.min(bottom, y - radiusY); top = Math.max(top, y + radiusY);
  }
  if (!count) return { center: new Vector3(), halfHeight: 1, halfWidth: 0, verticalExtent: 0 };
  const halfWidth = (right - left) / 2, verticalExtent = (top - bottom) / 2;
  return {
    center: horizontal.clone().multiplyScalar((left + right) / 2).addScaledVector(vertical, (top + bottom) / 2),
    halfHeight: Math.max(halfWidth / aspect, verticalExtent), halfWidth, verticalExtent,
  };
}

export function mixFrame(from, to, t) {
  return { center: from.center.clone().lerp(to.center, t), halfHeight: from.halfHeight * (to.halfHeight / from.halfHeight) ** t };
}

export function revealProgress(t) {
  const x = Math.max(0, Math.min(1, (t - 0.55) / 0.45));
  return x * x * (3 - 2 * x);
}

export function cityFrame(slots, count, annualCount, size, aspect, basis) {
  const { center, halfHeight } = pileFrame(slots, count, size, aspect, basis);
  const annual = pileFrame(slots, annualCount, size, aspect, basis);
  // Retain period differences and some absolute-scale differences between cities.
  // The additive world-space margin occupies less of the view for larger cities.
  return {
    center,
    halfHeight: Math.max(halfHeight, annual.halfHeight * 0.65) * 1.12 + 20,
  };
}

// Offsets follow the camera's horizontal axis: both piles share orientation and depth.
export function comparisonFrame(slots, counts, size, aspect, separation, basis) {
  const right = basis?.right ?? viewRight;
  const combined = counts.flatMap((count, group) => slots.slice(0, count).map(slot => ({
    x: slot.x + right.x * (group ? separation : -separation) / (size * 1.045),
    y: slot.y,
    z: slot.z + right.z * (group ? separation : -separation) / (size * 1.045),
  })));
  const result = pileFrame(combined, combined.length, size, aspect, basis);
  result.halfHeight = result.halfHeight * 1.12 + size;
  return result;
}

// Frame the largest selectable formation once per cube unit. A horizontal
// radius is invariant under yaw, so orbiting never acts like a zoom control.
export function framingEnvelope(slots, count, size) {
  let radius = 0, top = 0;
  for (let i = 0; i < count; i++) {
    const { x, y, z } = slots[i];
    radius = Math.max(radius, Math.hypot(Math.abs(x * 1.045) + 0.5, Math.abs(z * 1.045) + 0.5) * size);
    top = Math.max(top, (y * 1.045 + 1) * size);
  }
  return { radius, top };
}

export function chapterFrame(slots, count, size, aspect, separation = 0) {
  const { radius, top } = framingEnvelope(slots, count, size);
  const vertical = top / 2 * viewUp.y + radius * Math.hypot(viewUp.x, viewUp.z);
  return {
    center: new Vector3(0, top / 2, 0),
    halfHeight: Math.max(1, (radius + separation) / aspect, vertical) * 1.12 + size * 0.55,
  };
}

// Interpolate the world units covered by the viewport, rather than interpolating
// magnification and then applying a second fit to transient cube counts.
export function chapterCameraAt(from, to, t) {
  return { center: from.center.clone().lerp(to.center, t), halfHeight: from.halfHeight + (to.halfHeight - from.halfHeight) * t };
}
