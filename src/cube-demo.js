import { quantifyVolume } from './cube-layout.js';
import { createCubeScene } from './cube-scene.js';
import { litresToCubicMetres, waterUseLitres } from './data.js';

export function mountCubeDemo(cities) {
  const controls = document.querySelector('#cube-controls');
  const mode = document.querySelector('#cube-mode');
  const residents = document.querySelector('#cube-residents');
  const cityPicker = document.querySelector('#cube-city');
  const period = document.querySelector('#cube-period');
  const stage = document.querySelector('#cube-stage');
  const zurich = cities.find(city => city.name === 'Zurich');
  const format = new Intl.NumberFormat('en-CH', { maximumFractionDigits: 3 });
  for (const city of cities.filter(city => city !== zurich)) {
    cityPicker.add(new Option(city.name, city.name));
  }

  let scene;
  try {
    scene = createCubeScene(stage);
  } catch {
    stage.hidden = true;
    document.querySelector('#cube-render-status').textContent =
      'WebGL is unavailable. The calculated volumes are still shown.';
  }

  function update() {
    const building = mode.value === 'building';
    const comparison = mode.value === 'compare';
    document.querySelector('#residents-field').hidden = !building;
    document.querySelector('#city-field').hidden = !comparison;
    period.options[0].disabled = mode.value !== 'person';
    if (period.selectedOptions[0].disabled) period.value = '30';
    const days = Number(period.value);
    const volume = (city, count, duration) =>
      litresToCubicMetres(waterUseLitres(count, city.litresPerResidentDay, duration));

    const groups = comparison
      ? [zurich, cities.find(city => city.name === cityPicker.value)].map(city => ({
          name: city === zurich ? 'Zürich (left)' : `${city.name} (right)`,
          volume: volume(city, city.residents, days),
        }))
      : [{
          name: building ? `${residents.value} residents` : 'One resident',
          volume: volume(zurich, building ? Number(residents.value) : 1, days),
        }];

    const volumePerCube = comparison ? 3_000_000 : building ? 20 : 0.262;
    document.querySelector('#cube-unit').textContent =
      `1 cube = ${format.format(volumePerCube)} m³. This unit stays fixed in this view.`;
    const labels = groups.map(group => {
      const { count, represented, remainder } = quantifyVolume(group.volume, volumePerCube);
      const remaining = remainder >= 0.0005 ? format.format(remainder) : remainder > 1e-9 ? '<0.001' : '0';
      const label = document.createElement('li');
      label.textContent = `${group.name} · ${format.format(group.volume)} m³ total · ${count} ${count === 1 ? "cube" : "cubes"} (${format.format(represented)} m³ shown) · ${remaining} m³ remainder`;
      return label;
    });
    document.querySelector('#cube-values').replaceChildren(...labels);
    scene?.show(groups.map(group => group.volume), { volumePerCube });
  }

  controls.disabled = false;
  controls.addEventListener('change', update);
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      controls.removeEventListener('change', update);
      scene?.dispose();
    });
  }
  update();
}
