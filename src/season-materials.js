import { AmbientLight, DirectionalLight, MeshBasicMaterial } from 'three';

export const waterFaces = ['#49858b', '#49858b', '#a1c9cc', '#315c60', '#6da3a8', '#6da3a8'];
const iceFaces = ['#a5bdc0', '#a5bdc0', '#e3eeee', '#829fa3', '#c4d7d9', '#c4d7d9'];

export function cubeFaceMaterials(colors = waterFaces) {
  return colors.map(color => new MeshBasicMaterial({ color }));
}

export function createSeasonMaterials() {
  return [cubeFaceMaterials(iceFaces), cubeFaceMaterials()];
}

export function addSeasonLights(scene) {
  const light = new DirectionalLight(0xffffff, 2.2);
  light.position.set(-5, 9, 6);
  scene.add(light, new AmbientLight(0xffffff, 1.15));
}
