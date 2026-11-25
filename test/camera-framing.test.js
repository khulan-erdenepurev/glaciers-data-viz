import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { cityFrame, mixFrame, revealProgress, viewRight, viewUp } from '../src/camera-framing.js';
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
