import { scaleLinear, select, pointer } from 'd3';
import { glaciers } from './data.js';
import { municipalContext, nearestObservation, seasonalBalance, seasonalScale } from './seasonal-balance.js';

const number = new Intl.NumberFormat('en-CH', { maximumFractionDigits: 3 });
const areaFormat = new Intl.NumberFormat('en-CH', { maximumFractionDigits: 8 });
const signed = new Intl.NumberFormat('en-CH', { maximumFractionDigits: 3, signDisplay: 'exceptZero' });
const hydroYear = year => `${year - 1}/${String(year).slice(-2)}`;
const value = (volume, units) => volume === null ? 'Unavailable' : `${signed.format(volume)} ${units}`;

export function mountGlacierExplorer({ get, observations, cities, scene, signal, onSelection }) {
  const glacier = get('explorer-glacier');
  const year = get('explorer-year');
  const city = get('explorer-city');
  const period = get('explorer-period');
  const timeline = select(get('explorer-timeline'));
  const byGlacier = new Map(glaciers.map(g => [g.id, observations.filter(row => row.glacierId === g.id)]));
  const annual = observations.map(row => row.annual).filter(Number.isFinite);
  const y = scaleLinear().domain([Math.min(0, ...annual), Math.max(0, ...annual)]).nice().range([74, 8]);
  const x = scaleLinear().range([58, 794]);
  let records;
  let record;
  let selectedYear = 2025;
  glacier.replaceChildren(...glaciers.map(g => new Option(g.name, g.id)));
  city.replaceChildren(...cities.map(c => new Option(c.name, c.municipalityId)));

  function drawHistory() {
    const first = records[0].year, last = records.at(-1).year;
    x.domain([first - 0.5, last + 0.5]);
    const barWidth = Math.min(18, (x(1) - x(0)) * 0.8);
    timeline.selectAll('*').remove();
    for (const tick of y.ticks(3)) {
      timeline.append('line').attr('x1', 54).attr('x2', 808).attr('y1', y(tick)).attr('y2', y(tick))
        .attr('stroke', tick === 0 ? '#65777b' : '#d6dfe0');
      timeline.append('text').attr('x', 48).attr('y', y(tick) + 4).attr('text-anchor', 'end').text(number.format(tick));
    }
    timeline.selectAll('rect').data(records.filter(r => r.annual !== null)).join('rect')
      .attr('x', r => x(r.year) - barWidth / 2).attr('width', barWidth)
      .attr('y', r => Math.min(y(r.annual), y(0))).attr('height', r => Math.max(1, Math.abs(y(r.annual) - y(0))))
      .append('title').text(r => `${hydroYear(r.year)} · ${value(r.annual, 'mm w.e.')}`);
    const gaps = [];
    records.slice(1).forEach((r, i) => {
      const start = records[i].year + 1, end = r.year - 1;
      if (start > end) return;
      const label = start === end ? String(start) : `${start}–${end}`;
      gaps.push(label);
      if (x(end) - x(start) > 90) timeline.append('text').attr('x', x((start + end) / 2))
        .attr('y', 58).attr('text-anchor', 'middle').text('No observations');
    });
    for (const tick of new Set([first, last])) timeline.append('text').attr('x', x(tick))
      .attr('y', 94).attr('text-anchor', 'middle').text(tick);
    timeline.append('line').attr('class', 'selected-year').attr('y1', 3).attr('y2', 78);
    get('year-coverage').textContent = `${first}–${last} · ${records.length} observed end years. ${gaps.length
      ? 'Missing: ' + gaps.join(', ') + '.' : 'Continuous annual coverage.'}`;
  }

  function updateContext() {
    const { water, ratio } = municipalContext(cities.find(c => c.municipalityId === city.value),
      period.value, seasonalBalance(record).annual);
    const meaning = water.period === 'monthly' && water.kind === 'derived' ? 'estimated monthly average, annual total ÷ 12'
      : water.period === 'monthly' && water.kind === 'reported' ? 'observed month ' + water.end
      : water.kind + ' ' + water.period + ' volume';
    const amount = water.volumeM3 === null ? 'Municipality-only volume unavailable'
      : `${number.format(water.volumeM3)} m³ · ${meaning}`;
    const comparison = ratio === null ? (record.annual >= 0 && record.annual !== null
      ? 'No annual glacier net loss in this year.' : 'Loss ratio unavailable.')
      : `Annual glacier loss equals ${number.format(ratio)}× this consumption.`;
    get('explorer-context').textContent = `${amount}. ${water.year} · ${water.scope} · ${water.measurementType}. ${water.warning} ${comparison}`;
    get('explorer-water-source').href = water.source.url;
  }

  function showYear(next) {
    record = next;
    selectedYear = next.year;
    year.value = String(selectedYear);
    get('year-back').disabled = next === records[0];
    get('year-forward').disabled = next === records.at(-1);
    const { winter, summer, annual } = seasonalBalance(next);
    for (const [name, season] of Object.entries({ winter, summer })) {
      get(name + '-value').textContent = value(season.volume, 'm³');
      get(name + '-specific').textContent = value(season.balance, 'mm w.e.');
    }
    get('explorer-net').textContent = value(annual, 'm³');
    get('explorer-scale').textContent = `1 cube = ${number.format(seasonalScale.volumePerCube)} m³ water equivalent · Glacier area ${next.area === null ? 'unavailable' : areaFormat.format(next.area) + ' km²'}`;
    get('explorer-measurement').textContent = `${hydroYear(next.year)} · Area ${next.area ?? 'unavailable'} km² · Annual net (winter + summer) ${value(next.annual, 'mm w.e.')}, or ${value(annual, 'm³')}.`;
    get('explorer-remainders').textContent = [['Winter', winter], ['Summer', summer]].map(([name, { cubes }]) =>
      name + (cubes ? `: ${cubes.count} whole cubes, ${number.format(cubes.remainder)} m³ below one cube.` : ': volume unavailable.')).join(' ');
    timeline.selectAll('rect').classed('is-selected', r => r.year === selectedYear);
    timeline.select('.selected-year').attr('x1', x(selectedYear)).attr('x2', x(selectedYear));
    scene?.show([winter.volume, summer.volume], seasonalScale);
    updateContext();
  }

  function loadHistory() {
    records = byGlacier.get(glacier.value);
    year.replaceChildren(...records.map(r => new Option(hydroYear(r.year), r.year)));
    drawHistory();
    showYear(nearestObservation(records, selectedYear));
  }

  function notify() {
    onSelection(glacier.value, city.value, period.value);
  }
  glacier.addEventListener('change', () => { loadHistory(); notify(); }, { signal });
  year.addEventListener('change', () => showYear(records[year.selectedIndex]), { signal });
  for (const [id, dir] of [['year-back', -1], ['year-forward', 1]]) {
    get(id).addEventListener('click', () => showYear(records[year.selectedIndex + dir]), { signal });
  }
  for (const control of [city, period]) {
    control.addEventListener('change', () => { updateContext(); notify(); }, { signal });
  }
  function selectAtPointer(event) {
    const endYear = Math.round(x.invert(pointer(event, timeline.node())[0]));
    const found = records.find(r => r.year === endYear);
    if (found && found !== record) showYear(found);
  }
  timeline.node().addEventListener('click', selectAtPointer, { signal });
  return {
    enter(glacierId, cityId, periodName) {
      glacier.value = glacierId;
      city.value = cityId;
      period.value = periodName;
      loadHistory();
    },
  };
}
