import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { glaciers, parseGlacierBalances } from '../src/data.js';
import { municipalContext, nearestObservation, seasonalBalance, seasonalScale } from '../src/seasonal-balance.js';
import { advancePiles, createPileSlots, maxCubesPerPile } from '../src/cube-layout.js';
import { seasonalFrame } from '../src/seasonal-frame.js';
import { parseSwissWater } from '../src/swiss-water.js';

const read = path => readFileSync(new URL('../data/' + path, import.meta.url), 'utf8');
const observations = parseGlacierBalances(read('massbalance_2025_r2025/massbalance_fixdate_2025_r2025.csv'));
const histories = glaciers.map(g => observations.filter(row => row.glacierId === g.id));

test('all historical seasonal formations share a bounded cube unit and preserve signed net volume', () => {
  assert.equal(seasonalScale.volumePerCube, 500000);
  for (const row of observations) {
    const { winter, summer, annual } = seasonalBalance(row);
    assert.ok(Math.abs(winter.volume + summer.volume - annual) < 0.000001);
    for (const { volume, cubes } of [winter, summer]) {
      assert.ok(cubes.count <= maxCubesPerPile);
      assert.ok(Math.abs(cubes.count * seasonalScale.volumePerCube + cubes.remainder - Math.abs(volume)) < 0.000001);
    }
  }
  const { winter, summer, annual } = seasonalBalance(histories[0].at(-1));
  assert.deepEqual([winter.volume, summer.volume, annual], [82104937.5, -204466312.5, -122361375]);
  assert.deepEqual([winter.cubes.count, summer.cubes.count], [164, 408]);
  assert.ok(seasonalBalance(nearestObservation(histories[0], 1916)).annual > 0);
});

test('year selection preserves shared observations and picks only observed years across gaps', () => {
  assert.deepEqual(histories.map(rows => [rows[0].year, rows.at(-1).year, rows.length]), [
    [1915, 2025, 111], [1997, 2025, 29], [1885, 2025, 44], [2005, 2025, 21], [2020, 2025, 6],
  ]);
  for (const rows of histories) assert.equal(nearestObservation(rows, 2020).year, 2020);
  assert.equal(nearestObservation(histories[4], 1916).year, 2020);
  assert.equal(nearestObservation(histories[2], 1958).year, 1909);
  assert.equal(nearestObservation(histories[2], 1990).year, 2007);
  assert.equal(nearestObservation([], 2025), null);
});

test('missing observations, zero and seasons with unusual signs stay distinguishable', () => {
  const missing = seasonalBalance({ winter: null, summer: 0, annual: null, area: 2 });
  assert.deepEqual(missing.winter, { balance: null, volume: null, cubes: null });
  assert.equal(missing.summer.volume, 0);
  assert.equal(missing.annual, null);
  const reversed = seasonalBalance({ winter: -10, summer: 40, annual: 30, area: 3 });
  assert.deepEqual([reversed.winter.volume, reversed.summer.volume, reversed.annual], [-30000, 120000, 90000]);
});

test('both formations fit a single zero-centred camera including same-sign observations', () => {
  const slots = createPileSlots();
  const counts = [164, 408], size = 2;
  for (const aspect of [0.65, 2.5]) {
    for (const signs of [[1, -1], [-1, 1], [-1, -1], [1, 1]]) {
      const frame = seasonalFrame(slots, counts, signs, size, aspect);
      assert.equal(frame.center.length(), 0);
      assert.equal(frame.offsets[0] === frame.offsets[1], signs[0] !== signs[1]);
      for (const [i, count] of counts.entries()) {
        for (const { x, y, z } of slots.slice(0, count)) {
          assert.ok((y * 1.045 + 1) * size < frame.halfHeight);
          const side = (x * 9 - z * 6) / Math.hypot(6, 9);
          const radius = size * 7.5 / Math.hypot(6, 9);
          assert.ok(Math.abs(side * size * 1.045 + frame.offsets[i]) + radius < frame.halfHeight * aspect);
        }
      }
    }
  }
});

test('rapid seasonal retargets retain settled neighbours and finish with the latest slot counts', () => {
  const winter = Array(164).fill(1), summer = Array(408).fill(1);
  let piles = advancePiles([winter, summer], [164, 350], 50);
  assert.equal(piles[0], winter);
  const retreat = piles[1][407];
  piles = advancePiles(piles, [130, 408], 15);
  assert.ok(piles[1][407] > retreat);
  assert.ok(piles[0][163] < 1);
  for (let i = 0; i < 40; i++) piles = advancePiles(piles, [28, 60], 16);
  assert.deepEqual(piles, [Array(28).fill(1), Array(60).fill(1)]);
});

test('historical explorer uses Swiss reference years, reports regional gaps and suppresses gain ratios', () => {
  const cities = parseSwissWater(...['swiss_water_observations', 'swiss_city_comparison_candidates', 'swiss_city_population']
    .map(file => read('processed/swiss_water_cleaned/' + file + '.csv')));
  for (const city of cities) {
    for (const period of ['annual', 'monthly']) {
      const context = municipalContext(city, period, -122361375);
      const gain = municipalContext(city, period, 100000);
      assert.equal(gain.ratio, null);
      assert.equal(gain.water.volumeM3, context.water.volumeM3);
      assert.equal(context.water.year, city.reference.year);
      if (['2701', '6621'].includes(city.municipalityId)) {
        assert.equal(context.water.kind, 'unavailable');
        assert.equal(context.ratio, null);
      } else {
        assert.equal(context.ratio, 122361375 / context.water.volumeM3);
      }
    }
  }
});
