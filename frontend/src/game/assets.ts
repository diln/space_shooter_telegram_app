export interface GameAssets {
  backgroundMobile: HTMLImageElement;
  backgroundDesktop: HTMLImageElement;
  backgroundFallback: HTMLImageElement;
  shipIdle: HTMLImageElement;
  shipFire: HTMLImageElement;
  asteroids: HTMLImageElement[];
}

const ASSET_BASE = "/game-assets";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

let assetsPromise: Promise<GameAssets> | null = null;

export function loadGameAssets(): Promise<GameAssets> {
  if (assetsPromise) {
    return assetsPromise;
  }

  const asteroidFiles = Array.from({ length: 10 }, (_, idx) => `${ASSET_BASE}/asteroid_${String(idx + 1).padStart(2, "0")}.png`);

  assetsPromise = Promise.all([
    loadImage(`${ASSET_BASE}/background_mobile_9x16_1080x1920.png`),
    loadImage(`${ASSET_BASE}/background_desktop_16x9_1920x1080.png`),
    loadImage(`${ASSET_BASE}/background_full.png`),
    loadImage(`${ASSET_BASE}/ship_idle.png`),
    loadImage(`${ASSET_BASE}/ship_fire.png`),
    Promise.all(asteroidFiles.map((file) => loadImage(file))),
  ]).then(([backgroundMobile, backgroundDesktop, backgroundFallback, shipIdle, shipFire, asteroids]) => ({
    backgroundMobile,
    backgroundDesktop,
    backgroundFallback,
    shipIdle,
    shipFire,
    asteroids,
  }));

  return assetsPromise;
}
