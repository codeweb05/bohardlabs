import {createTheme, type Theme} from '@mui/material/styles';

/**
 * System stacks only. A preset that named a webfont would look right in a browser that
 * happened to have it and silently fall back everywhere else, including in the Vitest run,
 * which makes the theme picker a worse demonstration than no picker at all.
 */
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const SERIF = 'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif';
const ROUNDED = '"Avenir Next", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';

/**
 * A preset is a design language, not a palette.
 *
 * Colour is the obvious half, and on its own it makes eight themes that differ only in hue.
 * The other half is shape: how round a control is, how heavy a rule is, whether a menu
 * floats on a shadow or sits inside a border, whether a button shouts in uppercase. Those
 * are what make Tokyo Night read as a terminal and Catppuccin as a design system, and they
 * are also the properties most likely to be wrong in a component that was only ever built
 * against one app.
 *
 * Everything here is reachable from `createTheme` alone. What is deliberately absent is row
 * height, cell padding, body font size and header casing: the table sets those through `sx`
 * from its `density` and `headerCase` props, and `sx` outranks a theme's `styleOverrides`.
 * See Guides → Theming.
 */
interface PresetSpec {
  readonly mode: 'light' | 'dark';

  // Palette
  readonly primary: string;
  readonly secondary: string;
  readonly page: string;
  readonly surface: string;
  readonly text: string;
  readonly muted: string;
  readonly border: string;
  readonly headBg: string;
  readonly headText: string;
  readonly hover: string;
  readonly selected: string;

  // Shape
  /** Base radius. Controls, chips, menus and the table's own `Paper` all derive from it. */
  readonly radius: number;
  /** Chip and button radius, when the language wants a pill rather than the base radius. */
  readonly pill?: number;
  /** Outline weight on buttons and inputs, in px. */
  readonly outline: number;
  /** Rule under a body cell, in px. `0` drops it and lets whitespace separate the rows. */
  readonly rule: number;
  /** Rule under the header row, in px. The heavier it is, the more the header reads as a bar. */
  readonly headRule: number;
  /** Border style for both rules. `dashed` reads as a worksheet, `solid` as a table. */
  readonly ruleStyle: 'solid' | 'dashed';
  /** What a menu or popover sits on. A border with no shadow reads flat and technical. */
  readonly overlayShadow: string;

  // Type
  readonly font: string;
  readonly headFont: string;
  readonly headTracking: string;
  readonly headWeight: number;
  readonly buttonCase: 'none' | 'uppercase';
  readonly buttonTracking: string;
  readonly buttonWeight: number;
}

function preset(spec: PresetSpec): Theme {
  const control = spec.pill ?? spec.radius;

  return createTheme({
    palette: {
      mode: spec.mode,
      primary: {main: spec.primary},
      secondary: {main: spec.secondary},
      background: {default: spec.page, paper: spec.surface},
      text: {primary: spec.text, secondary: spec.muted},
      divider: spec.border,
      action: {hover: spec.hover, selected: spec.selected},
    },
    shape: {borderRadius: spec.radius},
    typography: {
      fontFamily: spec.font,
      button: {
        textTransform: spec.buttonCase,
        letterSpacing: spec.buttonTracking,
        fontWeight: spec.buttonWeight,
      },
      overline: {fontFamily: spec.headFont, letterSpacing: spec.headTracking},
    },
    components: {
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: spec.rule === 0 ? 'none' : `${spec.rule}px ${spec.ruleStyle} ${spec.border}`,
          },
          head: {
            backgroundColor: spec.headBg,
            color: spec.headText,
            fontFamily: spec.headFont,
            letterSpacing: spec.headTracking,
            fontWeight: spec.headWeight,
            borderBottom: `${spec.headRule}px solid ${spec.border}`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {borderRadius: control, boxShadow: 'none'},
          outlined: {borderWidth: spec.outline, '&:hover': {borderWidth: spec.outline}},
        },
      },
      MuiIconButton: {styleOverrides: {root: {borderRadius: Math.min(control, 12)}}},
      MuiChip: {
        styleOverrides: {
          root: {borderRadius: control, fontFamily: spec.headFont, fontWeight: spec.headWeight},
          outlined: {borderWidth: spec.outline},
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: control,
            '& .MuiOutlinedInput-notchedOutline': {borderWidth: spec.outline},
            '&:hover .MuiOutlinedInput-notchedOutline': {borderWidth: spec.outline},
          },
        },
      },
      // Menus, popovers, tooltips and the column popover all render on a `Paper`. Giving it
      // a border and a shadow of its own is most of what separates a flat technical theme
      // from one that floats.
      MuiPaper: {
        styleOverrides: {
          elevation8: {boxShadow: spec.overlayShadow, border: `1px solid ${spec.border}`},
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {borderRadius: spec.radius, fontFamily: spec.headFont, letterSpacing: spec.headTracking},
        },
      },
      MuiDivider: {styleOverrides: {root: {borderColor: spec.border}}},
    },
  });
}

/** Stock MUI, so a story has a baseline with no app tokens on it at all. */
const light = createTheme({palette: {mode: 'light'}});
const dark = createTheme({palette: {mode: 'dark'}});

/** Arctic and quiet: soft radius, hairline rules, nothing floats. */
const nord = preset({
  mode: 'dark',
  primary: '#88C0D0',
  secondary: '#A3BE8C',
  page: '#2E3440',
  surface: '#3B4252',
  text: '#ECEFF4',
  muted: '#D8DEE9',
  border: '#4C566A',
  headBg: '#434C5E',
  headText: '#ECEFF4',
  hover: 'rgba(136, 192, 208, 0.10)',
  selected: 'rgba(136, 192, 208, 0.20)',
  radius: 6,
  outline: 1,
  rule: 1,
  headRule: 1,
  ruleStyle: 'solid',
  overlayShadow: 'none',
  font: SANS,
  headFont: SANS,
  headTracking: '0.08em',
  headWeight: 600,
  buttonCase: 'none',
  buttonTracking: '0',
  buttonWeight: 500,
});

/** Loud: pill controls, uppercase buttons, and a glow under every overlay. */
const dracula = preset({
  mode: 'dark',
  primary: '#BD93F9',
  secondary: '#FF79C6',
  page: '#282A36',
  surface: '#2F3140',
  text: '#F8F8F2',
  muted: '#B8BFD6',
  border: '#44475A',
  headBg: '#44475A',
  headText: '#FF79C6',
  hover: 'rgba(189, 147, 249, 0.12)',
  selected: 'rgba(255, 121, 198, 0.20)',
  radius: 10,
  pill: 999,
  outline: 2,
  rule: 1,
  headRule: 2,
  ruleStyle: 'solid',
  overlayShadow: '0 0 0 1px #6272A4, 0 12px 32px rgba(0, 0, 0, 0.55)',
  font: SANS,
  headFont: MONO,
  headTracking: '0.06em',
  headWeight: 700,
  buttonCase: 'uppercase',
  buttonTracking: '0.10em',
  buttonWeight: 700,
});

/** A terminal: square, monospaced, hard 1px rules, no shadow anywhere. */
const tokyoNight = preset({
  mode: 'dark',
  primary: '#7AA2F7',
  secondary: '#BB9AF7',
  page: '#1A1B26',
  surface: '#1F2335',
  text: '#C0CAF5',
  muted: '#A9B1D6',
  border: '#2F3549',
  headBg: '#292E42',
  headText: '#7AA2F7',
  hover: 'rgba(122, 162, 247, 0.10)',
  selected: 'rgba(122, 162, 247, 0.18)',
  radius: 0,
  outline: 1,
  rule: 1,
  headRule: 2,
  ruleStyle: 'solid',
  overlayShadow: 'none',
  font: MONO,
  headFont: MONO,
  headTracking: '0.04em',
  headWeight: 700,
  buttonCase: 'none',
  buttonTracking: '0',
  buttonWeight: 500,
});

/** Printed matter: warm paper, serif headers, dashed hairlines, near-square corners. */
const solarizedLight = preset({
  mode: 'light',
  primary: '#268BD2',
  secondary: '#2AA198',
  page: '#EEE8D5',
  surface: '#FDF6E3',
  text: '#073642',
  muted: '#586E75',
  border: '#D6CDB4',
  headBg: '#EEE8D5',
  headText: '#586E75',
  hover: 'rgba(38, 139, 210, 0.08)',
  selected: 'rgba(38, 139, 210, 0.16)',
  radius: 2,
  outline: 1,
  rule: 1,
  headRule: 1,
  ruleStyle: 'dashed',
  overlayShadow: '0 2px 8px rgba(7, 54, 66, 0.12)',
  font: SERIF,
  headFont: SERIF,
  headTracking: '0.10em',
  headWeight: 600,
  buttonCase: 'uppercase',
  buttonTracking: '0.08em',
  buttonWeight: 600,
});

/** A design system: no rules at all, generous radius, everything on a soft shadow. */
const catppuccinLatte = preset({
  mode: 'light',
  primary: '#8839EF',
  secondary: '#179299',
  page: '#E6E9EF',
  surface: '#EFF1F5',
  text: '#4C4F69',
  muted: '#6C6F85',
  border: '#CCD0DA',
  headBg: '#DCE0E8',
  headText: '#5C5F77',
  hover: 'rgba(136, 57, 239, 0.07)',
  selected: 'rgba(136, 57, 239, 0.14)',
  radius: 14,
  pill: 999,
  outline: 1,
  rule: 0,
  headRule: 1,
  ruleStyle: 'solid',
  overlayShadow: '0 12px 32px rgba(76, 79, 105, 0.16)',
  font: ROUNDED,
  headFont: ROUNDED,
  headTracking: '0.02em',
  headWeight: 600,
  buttonCase: 'none',
  buttonTracking: '0',
  buttonWeight: 600,
});

/** The accessibility end: square, 2px outlines, heavy rules, uppercase and bold. */
const highContrast = preset({
  mode: 'light',
  primary: '#00308F',
  secondary: '#7A0019',
  page: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#000000',
  muted: '#1A1A1A',
  border: '#000000',
  headBg: '#000000',
  headText: '#FFFFFF',
  hover: 'rgba(0, 48, 143, 0.12)',
  selected: 'rgba(0, 48, 143, 0.24)',
  radius: 0,
  outline: 2,
  rule: 2,
  headRule: 3,
  ruleStyle: 'solid',
  overlayShadow: '0 0 0 2px #000000',
  font: SANS,
  headFont: SANS,
  headTracking: '0.08em',
  headWeight: 700,
  buttonCase: 'uppercase',
  buttonTracking: '0.06em',
  buttonWeight: 700,
});

export const THEME_PRESETS = [
  {id: 'light', title: 'Light (stock MUI)', theme: light},
  {id: 'dark', title: 'Dark (stock MUI)', theme: dark},
  {id: 'nord', title: 'Nord', theme: nord},
  {id: 'dracula', title: 'Dracula', theme: dracula},
  {id: 'tokyoNight', title: 'Tokyo Night', theme: tokyoNight},
  {id: 'solarizedLight', title: 'Solarized Light', theme: solarizedLight},
  {id: 'catppuccinLatte', title: 'Catppuccin Latte', theme: catppuccinLatte},
  {id: 'highContrast', title: 'High contrast', theme: highContrast},
] as const;

export const DEFAULT_THEME = light;

export const THEMES: Record<string, Theme> = Object.fromEntries(THEME_PRESETS.map((entry) => [entry.id, entry.theme]));
