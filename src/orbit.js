import { Vector3 } from 'three';

const worldUp = new Vector3(0, 1, 0);
const wrapAngle = degrees => ((degrees % 360) + 360) % 360;

export function orbitView(base, degrees) {
  const angle = wrapAngle(degrees) * Math.PI / 180;
  const direction = base.clone().applyAxisAngle(worldUp, angle);
  const right = new Vector3().crossVectors(worldUp, direction).normalize();
  return { direction, right, up: new Vector3().crossVectors(direction, right).normalize() };
}

export function createOrbit() {
  const listeners = new Set();
  let angle = 0;
  return {
    get angle() { return angle; },
    set(value) {
      if (!Number.isFinite(value)) return;
      const next = wrapAngle(value);
      if (next === angle) return;
      angle = next;
      listeners.forEach(listener => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function bindOrbit(surface, orbit, reset, signal) {
  let gesture;
  let suppressClick = false;
  function end(event) {
    if (gesture?.id !== event.pointerId) return;
    suppressClick = gesture.dragging;
    gesture = undefined;
    surface.classList.remove('is-orbiting');
  }

  surface.classList.add('orbit-surface');
  surface.tabIndex = 0;
  surface.setAttribute('aria-label', '3D view. Drag sideways or use the left and right arrow keys to rotate.');
  surface.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('button, a, select, input')) return;
    suppressClick = false;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: orbit.angle, dragging: false };
  }, { signal });
  surface.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 7 && Math.abs(dy) > Math.abs(dx)) { end(event); return; }
      if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy)) return;
      gesture.dragging = true;
      surface.setPointerCapture(event.pointerId);
      surface.classList.add('is-orbiting');
    }
    orbit.set(gesture.angle - dx * 0.24);
  }, { signal });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave']) {
    surface.addEventListener(type, end, { signal });
  }
  surface.addEventListener('click', event => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true, signal });
  surface.addEventListener('keydown', event => {
    if (event.target !== surface || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    orbit.set(orbit.angle + (event.key === 'ArrowLeft' ? -4 : 4));
  }, { signal });
  reset.addEventListener('click', () => orbit.set(0), { signal });
}
