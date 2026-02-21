export interface GameAssets {
  backgroundMobile: HTMLImageElement;
  backgroundDesktop: HTMLImageElement;
  backgroundFallback: HTMLImageElement;
  shipIdle: HTMLImageElement;
  shipFire: HTMLImageElement;
  asteroids: HTMLCanvasElement[];
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

function extractPrimaryAsteroidSprite(image: HTMLImageElement): HTMLCanvasElement {
  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  const sourceCtx = source.getContext("2d");
  if (!sourceCtx) {
    throw new Error("Unable to create source canvas for asteroid sprite");
  }
  sourceCtx.drawImage(image, 0, 0);

  const imageData = sourceCtx.getImageData(0, 0, source.width, source.height);
  const data = imageData.data;
  const width = source.width;
  const height = source.height;
  const visited = new Uint8Array(width * height);
  const alphaThreshold = 22;

  type Component = { area: number; minX: number; minY: number; maxX: number; maxY: number; centerDist: number };
  let best: Component | null = null;

  const stackX = new Int32Array(width * height);
  const stackY = new Int32Array(width * height);

  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (visited[idx]) {
        continue;
      }
      visited[idx] = 1;

      if (data[idx * 4 + 3] <= alphaThreshold) {
        continue;
      }

      let top = 0;
      stackX[top] = x;
      stackY[top] = y;
      top += 1;

      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let sumX = 0;
      let sumY = 0;

      while (top > 0) {
        top -= 1;
        const px = stackX[top];
        const py = stackY[top];
        const pIdx = py * width + px;

        if (data[pIdx * 4 + 3] <= alphaThreshold) {
          continue;
        }

        area += 1;
        sumX += px;
        sumY += py;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;

        const neighbors = [
          [px - 1, py],
          [px + 1, py],
          [px, py - 1],
          [px, py + 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          const nIdx = ny * width + nx;
          if (visited[nIdx]) {
            continue;
          }
          visited[nIdx] = 1;
          if (data[nIdx * 4 + 3] > alphaThreshold) {
            stackX[top] = nx;
            stackY[top] = ny;
            top += 1;
          }
        }
      }

      if (area <= 0) {
        continue;
      }

      const compCenterX = sumX / area;
      const compCenterY = sumY / area;
      const centerDist = (compCenterX - cx) * (compCenterX - cx) + (compCenterY - cy) * (compCenterY - cy);
      const candidate: Component = { area, minX, minY, maxX, maxY, centerDist };

      if (!best) {
        best = candidate;
        continue;
      }

      // Prefer larger component; if close in size, prefer one closer to center.
      if (candidate.area > best.area * 1.08 || (candidate.area > best.area * 0.92 && candidate.centerDist < best.centerDist)) {
        best = candidate;
      }
    }
  }

  if (!best) {
    return source;
  }

  const padding = 10;
  const cropX = Math.max(0, best.minX - padding);
  const cropY = Math.max(0, best.minY - padding);
  const cropWidth = Math.min(width - cropX, best.maxX - best.minX + 1 + padding * 2);
  const cropHeight = Math.min(height - cropY, best.maxY - best.minY + 1 + padding * 2);

  const size = Math.max(cropWidth, cropHeight);
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const outCtx = out.getContext("2d");
  if (!outCtx) {
    throw new Error("Unable to create output canvas for asteroid sprite");
  }

  const dx = (size - cropWidth) / 2;
  const dy = (size - cropHeight) / 2;
  outCtx.drawImage(source, cropX, cropY, cropWidth, cropHeight, dx, dy, cropWidth, cropHeight);
  return out;
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
    asteroids: asteroids.map((sprite) => extractPrimaryAsteroidSprite(sprite)),
  }));

  return assetsPromise;
}
