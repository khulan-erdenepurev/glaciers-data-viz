import { AmbientLight, DirectionalLight, MeshPhongMaterial, MeshStandardMaterial, DataTexture, RGBAFormat } from 'three';

export function createSeasonMaterials({ dark = false } = {}) {
  // A fine, matte grain on ice and a translucent, glossy face with a waterline.
  function surfaceTexture(water) {
    const size = 32;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const grain = (x * 19 + y * 37 + x * y * 7) % 23;
        const border = x === 0 || x === size - 1 || y === 0 || y === size - 1;
        const shade = dark && border ? (water ? 255 : 205)
          : water ? (y === 26 || y === 27 ? 255 : 205 + y) : 232 + grain;
        pixels.set([shade, shade, shade, 255], (y * size + x) * 4);
      }
    }
    const map = new DataTexture(pixels, size, size, RGBAFormat);
    map.needsUpdate = true;
    return map;
  }
  const ice = new MeshStandardMaterial({ color: dark ? '#d8efff' : '#d1e9f1', roughness: 0.95, map: surfaceTexture(false) });
  const water = new MeshPhongMaterial({ color: dark ? '#17b6f1' : '#147fa6', specular: '#c8f6ff', shininess: 85,
    transparent: true, opacity: dark ? 0.86 : 0.76, map: surfaceTexture(true) });
  return [ice, water];
}

export function addSeasonLights(scene) {
  const light = new DirectionalLight(0xffffff, 2.2);
  light.position.set(-5, 9, 6);
  scene.add(light, new AmbientLight(0xffffff, 1.15));
}
