import { csvParse } from 'd3';

function number(raw) {
  if (raw == null || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid Swiss water data value: ${raw}`);
  return value;
}

function attribution(row) {
  return { file: row.source_file, url: row.source_url, location: row.source_location || row.source_sheet || null };
}

export function parseSwissWater(observationsCsv, candidatesCsv, populationCsv) {
  const populationById = new Map(csvParse(populationCsv).map(row => [row.bfs_code, row]));
  const observations = csvParse(observationsCsv).map(row => ({
    name: row.city,
    municipalityId: row.bfs_code,
    year: number(row.year),
    period: row.period,
    start: row.period_start || null,
    end: row.period_end || null,
    volumeM3: number(row.water_volume_m3),
    litresPerResidentDay: number(row.per_capita_liters_day),
    measurementType: row.measurement_type,
    scope: row.geographic_scope,
    completeness: row.data_completeness,
    kind: row.is_estimate === 'true' ? 'estimated'
      : row.period === 'annual' && row.calculation.startsWith('sum of monthly records') ? 'derived' : 'reported',
    calculation: row.calculation || null,
    populationUsed: number(row.population_used),
    populationYear: number(row.population_year),
    municipalityTotal: row.usable_as_city_total === 'true',
    source: attribution(row),
    warning: row.notes,
  }));

  return csvParse(candidatesCsv).map(row => {
    const id = row.bfs_code;
    const population = populationById.get(id);
    const history = observations.filter(record => record.municipalityId === id);
    const reference = history.find(record => record.period === 'annual' &&
      record.year === number(row.reference_year) && record.measurementType === row.measurement_type &&
      record.scope === row.geographic_scope && record.volumeM3 === number(row.annual_water_volume_m3));
    if (!population || population.city !== row.city || !reference || reference.name !== row.city) {
      throw new Error(`Swiss water tables disagree for ${row.city} (${id})`);
    }
    return {
      name: row.city,
      municipalityId: id,
      population: number(population.population),
      populationYear: number(population.year),
      populationSource: attribution(population),
      reference,
      observations: history,
      directCityTotal: row.use_for_direct_cross_city_comparison === 'true',
      warning: row.quality_flag,
    };
  });
}

const usable = record => record.municipalityTotal && record.volumeM3 !== null &&
  (record.completeness === 'complete' || record.kind === 'estimated');

export function cityConsumption(city, period, month = null) {
  const reference = city.reference;
  if (period === 'monthly') {
    const observed = city.observations.filter(record => record.period === 'monthly' &&
      record.year === reference.year && record.scope === reference.scope &&
      record.kind === 'reported' && usable(record) && (!month || record.end === month))
      .sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))[0];
    if (observed) return observed;
    // An explicitly requested month has no observation. Any available fallback
    // is labelled as an average with no month attached.
    if (reference.period === 'annual' && usable(reference)) {
      return { ...reference, period, start: null, end: null, volumeM3: reference.volumeM3 / 12,
        kind: 'derived', calculation: 'Annual total ÷ 12' };
    }
  }
  if (period === 'annual' && reference.period === 'annual' && usable(reference)) return reference;
  return { ...reference, period, start: null, end: null, volumeM3: null, kind: 'unavailable' };
}
