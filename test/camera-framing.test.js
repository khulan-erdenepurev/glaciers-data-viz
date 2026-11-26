import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { cityFrame, chapterCameraAt, chapterFrame, mixFrame, revealProgress, viewDirection, viewRight, viewUp } from '../src/camera-framing.js';
import { createOrbit, orbitView } from '../src/orbit.js';
import { createPileSlots, quantifyVolume } from '../src/cube-layout.js';
import { cityCubeScale } from '../src/scale-transition.js';
import { parseCities, waterUseLitres, litresToCubicMetres } from '../src/data.js';

const read = path => readFileSync(new URL(`../data/${path}`, import.meta.url), 'utf8');
const cities = parseCities(read('residents_cities_water_usage.csv'), read('KANTON_ZUERICH_469.csv'));
const slots = createPileSlots();

test('every rendered cube corner fits city framing in both periods and portrait/wide canvases', () => {
  for (const city of cities) {
    const volume = days => litresToCubicMetres(waterUseLitres(city.residents, city.litresPerResidentDay, days));
    const scale = cityCubeScale(volume(365));
    for (const aspect of [0.5, 1, 1.8, 3]) {
      const frames = [];
      for (const days of [30, 365]) {
        const count = quantifyVolume(volume(days), scale.volumePerCube).count;
        const size = 0.26 * scale.edgeRatio;
        const frame = cityFrame(slots, count, scale.annualCount, size, aspect);
        frames.push(frame);
        for (const slot of slots.slice(0, count)) {
          for (const dx of [-0.5, 0.5]) for (const dy of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) {
            const point = new Vector3((slot.x * 1.045 + dx) * size,
              (slot.y * 1.045 + 0.5 + dy) * size, (slot.z * 1.045 + dz) * size).sub(frame.center);
            assert.ok(Math.abs(point.dot(viewRight)) < frame.halfHeight * aspect / 1.1, `${city.name} ${days}: horizontal margin`);
            assert.ok(Math.abs(point.dot(viewUp)) < frame.halfHeight / 1.1, `${city.name} ${days}: vertical margin`);
          }
        }
      }
      assert.ok(frames[0].halfHeight < frames[1].halfHeight, JSON.stringify({ city, aspect, frames, scale }));
    }
  }
});

test('late reveal has exact reversible endpoints and no jump at its start', () => {
  const from = { center: new Vector3(0, 2, 0), halfHeight: 8 };
  const to = { center: new Vector3(5, 30, 4), halfHeight: 300 };
  assert.equal(revealProgress(0.55), 0);
  assert.equal(revealProgress(1), 1);
  assert.deepEqual(mixFrame(from, to, revealProgress(1)), to);
  const forward = [0, 0.55, 0.6, 0.8, 1].map(t => mixFrame(from, to, revealProgress(t)));
  const backward = [1, 0.8, 0.6, 0.55, 0].map(t => mixFrame(from, to, revealProgress(t))).reverse();
  assert.deepEqual(forward, backward);
});

test('orbit crosses the seam at full yaw and preserves elevation and a fixed frame', () => {
  const orbit = createOrbit();
  const changes = [];
  const unsubscribe = orbit.subscribe(() => changes.push(orbit.angle));
  const aspect = 0.7;
  const frame = chapterFrame(slots, 300, 2, aspect);
  for (const [input, bound] of [[90, 90], [180, 180], [270, 270], [359, 359], [361, 1], [-1, 359], [720, 0]]) {
    orbit.set(input);
    const view = orbitView(viewDirection, orbit.angle);
    assert.equal(orbit.angle, bound);
    assert.equal(view.direction.y, viewDirection.y);
    assert.ok(Math.abs(view.direction.dot(view.right)) < 1e-12);
    assert.ok(Math.abs(view.direction.dot(view.up)) < 1e-12);
    for (const { x, y, z } of slots.slice(0, 300)) {
      const center = new Vector3(2.09 * x, 2.09 * y + 1, 2.09 * z);
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) {
        const corner = center.clone().add(new Vector3(dx, dy, dz)).sub(frame.center);
        assert.ok(Math.abs(corner.dot(view.right)) <= frame.halfHeight * aspect);
        assert.ok(Math.abs(corner.dot(view.up)) <= frame.halfHeight);
      }
    }
  }
  assert.ok(orbitView(viewDirection, 359).direction.distanceTo(orbitView(viewDirection, 361).direction) < 0.04);
  unsubscribe();
  assert.deepEqual(changes, [90, 180, 270, 359, 1, 359, 0]);
});

test('narrative camera covers a single monotonic path and returns to both fitted endpoints', () => {
  const frames = [
    chapterFrame(slots, 382, 1.1, 1.75),
    chapterFrame(slots, 1584, 12.1, 1.75),
    chapterFrame(slots, 244, 32.25, 2.8, 32.25 * 17),
  ];
  for (let i = 1; i < frames.length; i++) {
    const [from, to] = frames.slice(i - 1, i + 1);
    const samples = Array.from({ length: 101 }, (_, n) => chapterCameraAt(from, to, n / 100).halfHeight);
    assert.equal(samples[0], from.halfHeight);
    assert.ok(Math.abs(samples.at(-1) - to.halfHeight) < 1e-12);
    assert.ok(samples.every((height, n) => n === 0 || height >= samples[n - 1]));
  }
});
