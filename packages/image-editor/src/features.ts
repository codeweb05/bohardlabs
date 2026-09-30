import type {CropRatio, CropShape, ImageEditorFeatures} from './types.js';

export interface ResolvedFeatures {
  /** `enabled: false` means the crop is the whole frame and there is no crop box. */
  crop: {enabled: boolean; ratios: CropRatio[]; shape: CropShape};
  zoom: false | {min: number; max: number; slider: boolean};
  rotate: boolean;
  flip: false | {horizontal: boolean; vertical: boolean};
  replace: boolean;
  straighten: false | {range: number};
  adjust: false | {brightness: boolean; contrast: boolean; saturation: boolean; presets: boolean};
  history: boolean;
}

export const DEFAULT_RATIOS: CropRatio[] = ['free', '1:1', '4:3', '16:9'];

/** Width ÷ height, or `null` for a free crop (and for anything that is not a usable ratio). */
export function parseRatio(ratio: CropRatio): number | null {
  if (typeof ratio === 'number') return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(ratio);
  if (!match) return null;
  const value = Number(match[1]) / Number(match[2]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isUsable(ratio: CropRatio): boolean {
  return ratio === 'free' || parseRatio(ratio) !== null;
}

function options<T extends object>(value: boolean | T | undefined, fallback: boolean): T | null {
  if (value === undefined) return fallback ? ({} as T) : null;
  if (value === false) return null;
  return value === true ? ({} as T) : value;
}

export function resolveFeatures(features: ImageEditorFeatures | undefined): ResolvedFeatures {
  const f = features ?? {};

  const crop = options(f.crop, true);
  const shape: CropShape = crop?.shape === 'circle' ? 'circle' : 'rect';
  const given = (crop?.ratios ?? []).filter(isUsable);
  let ratios: CropRatio[] = given.length ? given : DEFAULT_RATIOS;
  if (shape === 'circle') ratios = ['1:1'];
  if (!crop) ratios = ['free'];

  const zoom = options(f.zoom, true);
  const zoomMin = Math.max(1, zoom?.min ?? 1);
  const zoomMax = Math.max(zoomMin, zoom?.max ?? 3);

  const flip = options(f.flip, true);
  const horizontal = flip?.horizontal ?? true;
  const vertical = flip?.vertical ?? true;

  const straighten = options(f.straighten, false);
  const range = Math.min(90, Math.max(1, straighten?.range ?? 45));

  const adjust = options(f.adjust, false);
  const tools = {
    brightness: adjust?.brightness ?? true,
    contrast: adjust?.contrast ?? true,
    saturation: adjust?.saturation ?? true,
    presets: adjust?.presets ?? true,
  };

  return {
    crop: {enabled: crop !== null, ratios, shape},
    zoom: zoom ? {min: zoomMin, max: zoomMax, slider: zoom.slider ?? false} : false,
    rotate: f.rotate ?? true,
    flip: flip && (horizontal || vertical) ? {horizontal, vertical} : false,
    replace: f.replace ?? false,
    straighten: straighten ? {range} : false,
    adjust: adjust && Object.values(tools).some(Boolean) ? tools : false,
    history: f.history ?? false,
  };
}
