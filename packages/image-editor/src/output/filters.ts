import type {Adjustments} from '../state/editorState';

export type PresetId = 'original' | 'vivid' | 'mono' | 'fade' | 'dramatic';

/** Each preset is a position of the three sliders, so moving a slider afterwards is exact. */
export const PRESETS: readonly {id: PresetId; values: Adjustments}[] = [
  {id: 'original', values: {brightness: 0, contrast: 0, saturation: 0}},
  {id: 'vivid', values: {brightness: 5, contrast: 15, saturation: 35}},
  {id: 'mono', values: {brightness: 0, contrast: 10, saturation: -100}},
  {id: 'fade', values: {brightness: 10, contrast: -25, saturation: -20}},
  {id: 'dramatic', values: {brightness: -10, contrast: 40, saturation: -10}},
];

export function presetOf(adjust: Adjustments): PresetId | null {
  const match = PRESETS.find(
    ({values}) =>
      values.brightness === adjust.brightness &&
      values.contrast === adjust.contrast &&
      values.saturation === adjust.saturation,
  );
  return match ? match.id : null;
}

/** The same string drives the CSS preview and `ctx.filter` at export. */
export function filterString(adjust: Adjustments): string {
  if (adjust.brightness === 0 && adjust.contrast === 0 && adjust.saturation === 0) return 'none';
  const factor = (value: number) => Number((1 + value / 100).toFixed(2));
  return `brightness(${factor(adjust.brightness)}) contrast(${factor(adjust.contrast)}) saturate(${factor(adjust.saturation)})`;
}

/** Safari before 18 ignores `ctx.filter`; there the adjust tools are hidden rather than lying. */
export function supportsCanvasFilter(): boolean {
  return typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
}
