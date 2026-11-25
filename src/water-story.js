import { quantifyVolume } from './cube-layout.js';
import { createCubeScene } from './cube-scene.js';
import { litresToCubicMetres, waterUseLitres } from './data.js';

const titles = ['Individual water consumption', 'Apartment water consumption', 'City water consumption'];
const cubeUnits = [0.262, 20, 3_000_000];
const residentCounts = [40, 50, 60, 70, 80];
const format = new Intl.NumberFormat('en-CH', { maximumFractionDigits: 3 });

function makeFigures(container, count, className) {
  while (container.childElementCount > count) container.lastElementChild.remove();
  while (container.childElementCount < count) {
    const figure = document.createElement('span');
    figure.className = className;
    container.append(figure);
  }
}

export function mountWaterStory(cities) {
  const story = document.querySelector('#story');
  const get = id => story.querySelector(`#${id}`);
  const steps = Array.from(story.querySelectorAll('.story-step'));
  const links = Array.from(story.querySelectorAll('.chapter-nav a'));
  const contexts = ['individual-context', 'apartment-context', 'city-context'].map(get);
  const subjectControls = get('subject-controls');
  const periodControls = get('period-controls');
  const subject = get('story-subject');
  const period = get('story-period');
  const stage = get('cube-stage');
  const zurich = cities.find(city => city.name === 'Zurich');
  const cityName = city => city === zurich ? 'Zürich' : city.name;
  const cityOptions = ['Zurich', 'London', 'New York', 'Paris', 'Tokyo']
    .map(name => cities.find(city => city.name === name));
  const controller = new AbortController();
  const { signal } = controller;

  let chapter = -1;
  let personDays = 30;
  let sharedDays = 30;
  let residents = 40;
  let city = zurich;
  let scene;
  let scrollFrame;

  story.hidden = false;
  try {
    scene = createCubeScene(stage, { frameHalfWidth: 3.15 });
  } catch {
    stage.hidden = true;
    get('cube-render-status').textContent = 'WebGL is unavailable. The calculated volumes are still shown.';
  }

  function update() {
    const days = chapter === 0 ? personDays : sharedDays;
    period.value = String(days);
    if (chapter === 1) {
      const floors = residents / 10;
      makeFigures(get('resident-icons'), residents, 'person-glyph');
      makeFigures(get('building-floors'), floors, 'building-floor');
      get('building-caption').textContent = `${residents} residents · ${floors} illustrative floors`;
    }
    if (chapter === 2) {
      get('city-map').textContent = `${cityName(city)} · Map placeholder`;
      get('city-population').textContent = `${format.format(city.residents)} residents`;
    }

    const count = [1, residents, city.residents][chapter];
    const rate = (chapter === 2 ? city : zurich).litresPerResidentDay;
    const volume = litresToCubicMetres(waterUseLitres(count, rate, days));
    const volumePerCube = cubeUnits[chapter];
    const { count: cubes, represented, remainder } = quantifyVolume(volume, volumePerCube);
    const periodName = period.selectedOptions[0].textContent.toLowerCase();
    get('cube-values').textContent = `${format.format(volume)} m³ per ${periodName}${chapter === 2 ? ' (estimate)' : ''}`;
    get('cube-unit').textContent =
      `1 cube = ${format.format(volumePerCube)} m³ · ${cubes} ${cubes === 1 ? 'cube' : 'cubes'} (${format.format(represented)} m³ shown) · ${format.format(remainder)} m³ remainder`;
    scene?.show([volume], { volumePerCube });
  }

  function activate(index) {
    if (chapter === index) return;
    chapter = index;
    story.dataset.chapter = steps[index].id;
    get('chapter-title').textContent = `0${index + 1} · ${titles[index]}`;
    links.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    contexts.forEach((context, i) => { context.hidden = i !== index; });
    subjectControls.hidden = index === 0;
    period.options[0].hidden = index !== 0;
    period.options[0].disabled = index !== 0;
    if (index !== 0) {
      const label = index === 1 ? 'Residents' : 'City';
      const options = index === 1
        ? residentCounts.map(count => new Option(count, count))
        : cityOptions.map(item => new Option(cityName(item), item.name));
      get('subject-label').textContent = label;
      subject.replaceChildren(...options);
      subject.value = index === 1 ? String(residents) : city.name;
      subjectControls.querySelector('[data-step="-1"]').setAttribute('aria-label', `Previous ${label.toLowerCase()} option`);
      subjectControls.querySelector('[data-step="1"]').setAttribute('aria-label', `Next ${label.toLowerCase()} option`);
    }
    update();
  }

  function syncScroll() {
    let index = 0;
    const threshold = window.innerHeight * 0.4;
    steps.forEach((step, i) => { if (step.getBoundingClientRect().top <= threshold) index = i; });
    activate(index);
  }

  function scheduleScroll() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(syncScroll);
  }

  subject.addEventListener('change', () => {
    if (chapter === 1) residents = Number(subject.value);
    if (chapter === 2) city = cityOptions.find(item => item.name === subject.value);
    update();
  }, { signal });
  period.addEventListener('change', () => {
    const days = Number(period.value);
    if (chapter === 0 || personDays !== 1) personDays = days;
    sharedDays = days === 1 ? 30 : days;
    update();
  }, { signal });

  function stepOption(select, direction) {
    const choices = Array.from(select.options).filter(option => !option.disabled);
    const index = choices.indexOf(select.selectedOptions[0]);
    select.value = choices[(index + direction + choices.length) % choices.length].value;
    select.dispatchEvent(new Event('change'));
  }

  for (const [controls, select] of [[subjectControls, subject], [periodControls, period]]) {
    controls.addEventListener('click', event => {
      const button = event.target.closest('[data-step]');
      if (button) stepOption(select, Number(button.dataset.step));
    }, { signal });
  }

  let lastWheel = -Infinity;
  for (const [target, select] of [[subjectControls, subject], [get('city-map'), subject],
    [periodControls, period], [stage, period], [get('cube-values'), period], [get('city-population'), period]]) {
    target.addEventListener('wheel', event => {
      if (event.ctrlKey || !event.cancelable || Math.abs(event.deltaX) <= 1.5 * Math.abs(event.deltaY) ||
          Math.abs(event.deltaX) < 1) return;
      event.preventDefault();
      if (event.timeStamp - lastWheel > 180) stepOption(select, Math.sign(event.deltaX));
      lastWheel = event.timeStamp;
    }, { passive: false, signal });
  }

  window.addEventListener('scroll', scheduleScroll, { passive: true, signal });
  window.addEventListener('resize', scheduleScroll, { signal });
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      controller.abort();
      cancelAnimationFrame(scrollFrame);
      scene?.dispose();
    });
  }
  syncScroll();
}
