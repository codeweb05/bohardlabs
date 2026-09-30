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
