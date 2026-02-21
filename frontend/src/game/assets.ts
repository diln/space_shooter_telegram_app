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

interface ExtractedAsteroid {
  sprite: HTMLCanvasElement;
  touchesEdge: boolean;
}

function mirrorCanvas(input: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = input.width;
  out.height = input.height;
  const ctx = out.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create mirror canvas for asteroid sprite");
  }
  ctx.translate(out.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(input, 0, 0);
  return out;
}

function extractPrimaryAsteroidSprite(image: HTMLImageElement): ExtractedAsteroid {
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

  type Component = { area: number; minX: number; minY: number; maxX: number; maxY: number; centerDist: number; pixels: number[] };
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
      const pixels: number[] = [];

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
        pixels.push(pIdx);
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
      const candidate: Component = { area, minX, minY, maxX, maxY, centerDist, pixels };

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
    return { sprite: source, touchesEdge: false };
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
  const drawX = Math.round(dx);
  const drawY = Math.round(dy);

  const outImageData = outCtx.createImageData(size, size);
  const outData = outImageData.data;

  for (const sourceIndex of best.pixels) {
    const sx = sourceIndex % width;
    const sy = Math.floor(sourceIndex / width);

    if (sx < cropX || sx >= cropX + cropWidth || sy < cropY || sy >= cropY + cropHeight) {
      continue;
    }

    const tx = sx - cropX + drawX;
    const ty = sy - cropY + drawY;
    if (tx < 0 || ty < 0 || tx >= size || ty >= size) {
      continue;
    }

    const sourceOffset = sourceIndex * 4;
    const targetOffset = (ty * size + tx) * 4;
    outData[targetOffset] = data[sourceOffset];
    outData[targetOffset + 1] = data[sourceOffset + 1];
    outData[targetOffset + 2] = data[sourceOffset + 2];
    outData[targetOffset + 3] = data[sourceOffset + 3];
  }

  const center = size / 2;
  const radius = size * 0.48;
  const feather = size * 0.07;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const alpha = outData[offset + 3];
      if (alpha === 0) {
        continue;
      }

      const dxFromCenter = x + 0.5 - center;
      const dyFromCenter = y + 0.5 - center;
      const dist = Math.sqrt(dxFromCenter * dxFromCenter + dyFromCenter * dyFromCenter);
      if (dist > radius) {
        outData[offset + 3] = 0;
      } else if (dist > radius - feather) {
        const factor = (radius - dist) / feather;
        outData[offset + 3] = Math.round(alpha * factor);
      }
    }
  }

  outCtx.putImageData(outImageData, 0, 0);

  const touchesEdge = best.minX <= 4 || best.minY <= 4 || best.maxX >= width - 5 || best.maxY >= height - 5;
  return { sprite: out, touchesEdge };
}

function buildAsteroidPool(asteroids: ExtractedAsteroid[]): HTMLCanvasElement[] {
  let base = asteroids.filter((item) => !item.touchesEdge).map((item) => item.sprite);
  if (base.length < 4) {
    base = asteroids.map((item) => item.sprite);
  }

  const mirrored = base.map((sprite) => mirrorCanvas(sprite));
  return [...base, ...mirrored];
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
    asteroids: buildAsteroidPool(asteroids.map((sprite) => extractPrimaryAsteroidSprite(sprite))),
  }));

  return assetsPromise;
}
