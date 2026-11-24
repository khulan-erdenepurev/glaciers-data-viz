import { axisBottom, axisLeft, extent, line, scaleLinear, select, symbol, symbolCircle, symbolDiamond, symbolSquare } from 'd3';
import { observationTimeline } from './data.js';

const series = [
  { key: 'winter', shape: symbolCircle },
  { key: 'summer', shape: symbolSquare },
  { key: 'annual', shape: symbolDiamond },
];

export function renderCharts(container, glaciers, records) {
  const width = 880;
  const height = 184;
  const left = 62;
  const right = width - 23;
  const bottom = height - 28;
  const x = scaleLinear(extent(records, row => row.year), [left, right]);
  const values = records.flatMap(row => series.map(({ key }) => row[key])).filter(value => value != null);
  const y = scaleLinear([Math.min(0, ...values), Math.max(0, ...values)], [bottom, 10]).nice();

  for (const glacier of glaciers) {
    const observations = records.filter(row => row.glacierId === glacier.id);
    const timeline = observationTimeline(observations);
    const panel = select(container).append('section').attr('class', 'panel');
    panel.append('h2').text(glacier.name);
    const svg = panel.append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `${glacier.name}, ${observations.length} observed years. Exact values are available in the table.`);
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${left},0)`)
      .call(axisLeft(y).ticks(4).tickSize(-(right - left)));
    svg.append('g').attr('transform', `translate(0,${bottom})`)
      .call(axisBottom(x).tickValues([1885, 1905, 1925, 1945, 1965, 1985, 2005, 2025]).tickFormat(String));
    svg.append('line').attr('class', 'zero')
      .attr('x1', left).attr('x2', right).attr('y1', y(0)).attr('y2', y(0));

    for (const { key, shape } of series) {
      const group = svg.append('g').attr('class', key);
      const path = line().defined(row => row[key] != null)
        .x(row => x(row.year)).y(row => y(row[key]));
      group.append('path').attr('class', 'series-line').attr('d', path(timeline));
      group.selectAll('.point').data(observations.filter(row => row[key] != null)).join('path')
        .attr('class', row => key === 'annual' && row.annual > 0 ? 'point positive' : 'point')
        .attr('d', symbol(shape, key === 'annual' ? 13 : 8))
        .attr('transform', row => `translate(${x(row.year)},${y(row[key])})`)
        .append('title').text(row => `${row.year} · ${key} · ${row[key]} mm w.e.`);
    }

    const gaps = timeline.filter((row, index) => !row.glacierId && timeline[index - 1]?.glacierId)
      .map(row => {
        const next = observations.find(observation => observation.year > row.year);
        return `${row.year}–${next.year - 1}`;
      });
    if (gaps.length) panel.append('p').attr('class', 'gap-note').text(`No observations in ${gaps.join(', ')}.`);
  }
}
