import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPileSlots, maxCubesPerPile, quantifyVolume, retargetPile } from '../src/cube-layout.js';

test('fixed units increase cube counts and report the remainder', () => {
  assert.deepEqual([0.262, 7.86, 95.63].map(volume => quantifyVolume(volume, 0.262).count), [1, 30, 365]);
  const { count, represented, remainder } = quantifyVolume(314.4, 20);
  assert.equal(count, 15);
  assert.equal(represented, 300);
  assert.ok(Math.abs(remainder - 14.4) < 1e-9);
  assert.equal(quantifyVolume(628.8, 20).count, 31);
  assert.equal(quantifyVolume(3825.2, 20).count, 191);
});

test('city comparison shares a stable unit within the instance budget', () => {
  const unit = 3_000_000;
  assert.deepEqual([3556029.06, 43265020.23, 116922646.98, 1422558871.59]
    .map(volume => quantifyVolume(volume, unit).count), [1, 14, 38, 474]);
  assert.throws(() => quantifyVolume((maxCubesPerPile + 1) * unit, unit), /larger cube unit/);
});

test('stacking is repeatable and each upper cube has a unique earlier support', () => {
  const slots = createPileSlots();
  assert.deepEqual(slots, createPileSlots());
  assert.equal(slots.length, maxCubesPerPile);
  const placed = new Set();
  for (const { x, y, z } of slots) {
    const key = `${x},${y},${z}`;
    assert.ok(!placed.has(key));
    if (y) assert.ok(placed.has(`${x},${y - 1},${z}`));
    placed.add(key);
  }
});

test('reversing an in-flight removal reuses the same animated slot', () => {
  let progress = retargetPile([1, 1, 1], 1, 100);
  const removing = progress[1];
  assert.ok(removing > 0 && removing < 1);
  progress = retargetPile(progress, 4, 50);
  assert.equal(progress.length, 4);
  assert.ok(progress[1] > removing);
  progress = retargetPile(progress, 2, 500);
  assert.deepEqual(progress, [1, 1]);
});
