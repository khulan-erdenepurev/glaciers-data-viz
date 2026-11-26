import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseGlacierBalances } from '../src/data.js';
import { arenaCubeCapacity, arenaGlaciers, arenaHistory, arenaModes, encodeGlacier } from '../src/arena-data.js';

const source = readFileSync(new URL('../data/massbalance_2025_r2025/massbalance_fixdate_2025_r2025.csv', import.meta.url), 'utf8');
const records = parseGlacierBalances(source, arenaGlaciers);
const history = arenaHistory(records);

test('all five requested glacier IDs have verified 2024/25 observations and known coverage', () => {
  assert.equal(records.length, 351);
  assert.equal(parseGlacierBalances(source).length, 211);
  assert.deepEqual(arenaGlaciers.map(({ id }) => {
    const rows = records.filter(row => row.glacierId === id);
    const { winter, summer, annual, area } = history.get(2025).get(id);
    return [id, rows.length, rows[0].year, rows.at(-1).year, winter, summer, annual, area];
  }), [
    ['B36-26', 111, 1915, 2025, 1083, -2697, -1614, 75.8125],
    ['B43-03', 44, 1885, 2025, 1305, -2715, -1410, 13.29875],
    ['B56-03', 21, 2005, 2025, 1216, -1988, -772, 12.26875],
    ['A10g-05', 111, 1915, 2025, 711, -2983, -2272, 2.24437],
    ['B45-04', 64, 1962, 2025, 1462, -3639, -2177, 3.6425],
  ]);
  assert.equal(history.has(2026), false);
});

test('coverage follows the chosen year and missing observations do not become zero readings', () => {
  assert.deepEqual([...history.get(1961).keys()].sort(), ['A10g-05', 'B36-26']);
  assert.equal(history.get(2004).has('B43-03'), false);
  assert.equal(history.get(2005).has('B56-03'), true);
  assert.equal(history.get(2007).has('B43-03'), true);
  assert.equal(history.has(1910), false);
  for (const mode of Object.keys(arenaModes)) {
    const missing = encodeGlacier(history.get(2004).get('B43-03'), mode);
    assert.equal(missing.annual, null);
    assert.equal(missing.winter.value, null);
    assert.equal(missing.winter.count, 0);
  }
});

test('shared volume and specific units generate different formations and keep the annual sign', () => {
  const aletsch = history.get(2025).get('B36-26');
  const silvretta = history.get(2025).get('A10g-05');
  const volume = encodeGlacier(aletsch, 'volume');
  const specific = encodeGlacier(aletsch, 'specific');
  assert.deepEqual([volume.winter.count, volume.summer.count, volume.annual], [82, 204, -122361375]);
  assert.deepEqual([specific.winter.count, specific.summer.count, specific.annual], [54, 134, -1614]);
  assert.ok(volume.summer.count > encodeGlacier(silvretta, 'volume').summer.count);
  assert.ok(specific.summer.count < encodeGlacier(silvretta, 'specific').summer.count);
  assert.ok(encodeGlacier(history.get(1916).get('B36-26'), 'volume').annual > 0);
  assert.equal(encodeGlacier({ winter: -45, summer: 28, annual: -17 }, 'specific').winter.sign, -1);
  assert.equal(encodeGlacier({ winter: -45, summer: 28, annual: -17 }, 'specific').summer.sign, 1);
  const capacity = arenaCubeCapacity(records);
  for (const row of records) {
    assert.equal(row.winter + row.summer, row.annual);
    for (const [mode, { unit }] of Object.entries(arenaModes)) {
      const { winter, summer } = encodeGlacier(row, mode);
      for (const season of [winter, summer]) {
        assert.ok(season.count <= capacity);
        assert.ok(Math.abs(season.count * unit + season.remainder - Math.abs(season.value)) < 1e-6);
      }
    }
  }
});
