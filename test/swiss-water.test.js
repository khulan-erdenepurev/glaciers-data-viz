import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cityConsumption, parseSwissWater } from '../src/swiss-water.js';
import { glacierLoss, lossRatio } from '../src/comparison.js';
import { parseGlacierBalances } from '../src/data.js';

const read = path => readFileSync(new URL(`../data/${path}`, import.meta.url), 'utf8');
const cleaned = name => read(`processed/swiss_water_cleaned/${name}.csv`);
const [zurich, basel, bern, geneva, lausanne] = parseSwissWater(
  cleaned('swiss_water_observations'), cleaned('swiss_city_comparison_candidates'), cleaned('swiss_city_population'));

test('Swiss municipality IDs retain leading zeros and link to population and reference years', () => {
  assert.deepEqual([zurich, basel, bern, geneva, lausanne].map(city =>
    [city.name, city.municipalityId, city.reference.year, city.populationYear]), [
    ['Zürich', '0261', 2025, 2025], ['Basel', '2701', 2024, 2025], ['Bern', '0351', 2025, 2025],
    ['Genève', '6621', 2025, 2025], ['Lausanne', '5586', 2025, 2025],
  ]);
  const rate = zurich.observations.find(record => record.period === 'daily');
  assert.equal(rate.year, 2023);
  assert.equal(rate.volumeM3, null);
  assert.equal(rate.litresPerResidentDay, 262);
  assert.equal(zurich.population, 440935);
  assert.equal(zurich.reference.volumeM3, zurich.population * 262 * 365 / 1000);
  assert.equal(lausanne.reference.volumeM3, 21400844 * 55 / 100);
  assert.equal(geneva.reference.volumeM3, 49583 * 1000);
});

test('annual municipality figures preserve definitions and monthly estimates are labelled derived', () => {
  assert.equal(cityConsumption(bern, 'annual').volumeM3, 13.395 * 1_000_000);
  assert.equal(cityConsumption(bern, 'annual').kind, 'reported');
  assert.equal(bern.directCityTotal, true);
  for (const city of [zurich, lausanne]) {
    assert.equal(cityConsumption(city, 'annual').kind, 'estimated');
    assert.equal(city.directCityTotal, false);
    assert.ok(city.warning);
  }
  for (const city of [zurich, bern, lausanne]) {
    const month = cityConsumption(city, 'monthly');
    assert.equal(month.volumeM3, city.reference.volumeM3 / 12);
    assert.equal(month.year, city.reference.year);
    assert.equal(month.scope, city.reference.scope);
    assert.equal(month.kind, 'derived');
    assert.equal(month.end, null);
    assert.ok(month.source.url);
  }
  const october = { ...bern.reference, period: 'monthly', start: '2025-10-01', end: '2025-10', volumeM3: 900000 };
  assert.equal(cityConsumption({ ...bern, observations: [october] }, 'monthly'), october);
});

test('regional observations and missing months are preserved without producing city totals', () => {
  const monthly = year => basel.observations.filter(record => record.year === year && record.period === 'monthly');
  const complete = monthly(2024);
  assert.equal(complete.length, 12);
  assert.equal(complete.reduce((sum, row) => sum + row.volumeM3, 0), 20884167);
  assert.equal(monthly(2025).filter(record => record.volumeM3 === null).length, 5);
  const partial = basel.observations.find(record => record.year === 2025 && record.period === 'annual');
  assert.match(partial.completeness, /partial/);
  assert.equal(partial.volumeM3, 12205089);
  assert.equal(cityConsumption({ ...basel, reference: { ...partial, municipalityTotal: true } }, 'annual').volumeM3, null);
  for (const city of [basel, geneva]) {
    assert.equal(cityConsumption(city, 'annual').volumeM3, null);
    assert.equal(cityConsumption(city, 'monthly').kind, 'unavailable');
    assert.match(city.reference.scope, /Binningen|SIG|Services industriels/);
    assert.equal(city.directCityTotal, false);
  }
  const lastMonth = { ...bern.reference, period: 'monthly', start: '2025-12-01', end: '2025-12' };
  const withoutAnnual = { ...bern, reference: { ...bern.reference, volumeM3: null }, observations: [lastMonth] };
  assert.equal(cityConsumption(withoutAnnual, 'monthly'), lastMonth);
  assert.equal(cityConsumption(withoutAnnual, 'annual').volumeM3, null);
});

test('glacier ratios use the actual city volume and are absent for wider utility totals', () => {
  const glaciers = parseGlacierBalances(read('massbalance_2025_r2025/massbalance_fixdate_2025_r2025.csv'));
  const loss = glacierLoss(glaciers.find(record => record.glacierId === 'B36-26' && record.year === 2025));
  assert.equal(loss, 122361375);
  assert.equal(lossRatio(loss, cityConsumption(bern, 'annual').volumeM3), 122361375 / 13395000);
  assert.equal(lossRatio(loss, cityConsumption(bern, 'monthly').volumeM3), 122361375 / 1116250);
  assert.equal(lossRatio(loss, cityConsumption(geneva, 'annual').volumeM3), null);
});
