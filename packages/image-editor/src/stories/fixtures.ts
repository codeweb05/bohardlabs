/**
 * Test pictures drawn on a canvas, so the stories need no binary assets and a pixel check
 * knows exactly which colour sits where. These are file pixels, not UI colours.
 */
export const QUADRANT_COLOURS = {
  topLeft: '#e53935',
  topRight: '#43a047',
  bottomLeft: '#1e88e5',
  bottomRight: '#fdd835',
} as const;

/** Four solid quadrants, as a PNG data URL. */
export function quadrantsUrl(width = 1200, height = 800): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2d context');
  const w = width / 2;
  const h = height / 2;
  const cells: [string, number, number][] = [
    [QUADRANT_COLOURS.topLeft, 0, 0],
    [QUADRANT_COLOURS.topRight, w, 0],
    [QUADRANT_COLOURS.bottomLeft, 0, h],
    [QUADRANT_COLOURS.bottomRight, w, h],
  ];
  for (const [colour, x, y] of cells) {
    context.fillStyle = colour;
    context.fillRect(x, y, w, h);
  }
  return canvas.toDataURL('image/png');
}

/**
 * Random pixels, which compress badly: the input for a `maxBytes` check. Seeded, so every run
 * gets the same picture and the same file sizes.
 */
export function noiseUrl(width = 800, height = 600): string {
  // A 32-bit linear congruential generator: plenty for noise, and repeatable.
  let seed = 1;
  const next = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed >>> 24;
  };
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2d context');
  const pixels = context.createImageData(width, height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data[i] = next();
    pixels.data[i + 1] = next();
    pixels.data[i + 2] = next();
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function urlToFile(url: string, name: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, {type: blob.type});
}

/** One pixel of an encoded image, as `[r, g, b, a]`. */
export async function pixelAt(file: Blob, x: number, y: number): Promise<number[]> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2d context');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return [...context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data];
}

/** `'#43a047'` as `[67, 160, 71, 255]`, to compare with `pixelAt`. */
export function rgba(hex: string): number[] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}
