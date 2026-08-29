import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import {ThemeProvider, createTheme, type Theme} from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type {Preview} from '@storybook/react-vite';
import {INITIAL_VIEWPORTS} from 'storybook/viewport';

// The table hardcodes no colour, font or radius, which is a claim worth being able to
// check rather than read. Each preset below moves a different axis of a host app's theme,
// and every story repaints under all of them: palette mode, brand colour, component
// overrides, corner radius, density of the type scale, contrast.
//
// This is also the answer to the question people keep asking, which is why the table looks
// different here than in the app it came from. Nothing in the package changed. The app
// overrides `MuiTableCell` and `MuiTableRow` and sets its own shape tokens, and the table
// inherits all of it.

/** Stock MUI. The baseline a consumer gets before they theme anything. */
const lightTheme = createTheme({palette: {mode: 'light'}});
const darkTheme = createTheme({palette: {mode: 'dark'}});

/** A host app with a brand colour, a type scale and table component overrides. */
const brandedTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {main: '#00695f'},
    background: {default: '#f7f9f9', paper: '#ffffff'},
  },
  shape: {borderRadius: 8},
  typography: {fontFamily: '"Work Sans", "Segoe UI", system-ui, sans-serif'},
  components: {
    MuiTableCell: {
      styleOverrides: {
        root: {padding: '12px 16px', fontSize: '0.8125rem'},
        head: {
          fontSize: '0.7rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#0f3b36',
          backgroundColor: '#eef4f3',
          borderBottom: '2px solid #cfe0dd',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {root: {'&:hover': {backgroundColor: '#f2f7f6'}}},
    },
  },
});

/** The same brand after dark mode. Overrides that assumed a light page show up here. */
const brandedDarkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {main: '#4db6ac'},
    background: {default: '#101817', paper: '#16211f'},
  },
  shape: {borderRadius: 8},
  typography: {fontFamily: '"Work Sans", "Segoe UI", system-ui, sans-serif'},
  components: {
    MuiTableCell: {
      styleOverrides: {
        root: {padding: '12px 16px', fontSize: '0.8125rem'},
        head: {
          fontSize: '0.7rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#b2dfdb',
          backgroundColor: '#1c2b29',
          borderBottom: '2px solid #2f4542',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {root: {'&:hover': {backgroundColor: '#1b2725'}}},
    },
  },
});

/**
 * Maximum contrast, square corners, visible borders. The a11y addon runs against whichever
 * theme is active, so this is where a contrast failure that stock MUI's palette hides
 * (`primary.main` on a tint, at 13px) stops being a failure.
 */
const highContrastTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {main: '#00308f'},
    text: {primary: '#000000', secondary: '#1a1a1a'},
    divider: '#000000',
    background: {default: '#ffffff', paper: '#ffffff'},
  },
  shape: {borderRadius: 0},
  components: {
    MuiTableCell: {styleOverrides: {root: {borderBottom: '1px solid #000000'}}},
  },
});

/** Sharp and dense: no radius, small type, tight rows. What an ops console usually wants. */
const denseTheme = createTheme({
  palette: {mode: 'light', primary: {main: '#37474f'}},
  shape: {borderRadius: 0},
  typography: {fontSize: 12, fontFamily: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif'},
  components: {
    MuiTableCell: {styleOverrides: {root: {padding: '4px 10px', fontSize: '0.75rem'}}},
  },
});

/** The other extreme: large radius, roomy rows, bigger type. */
const softTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {main: '#6d4aff'},
    background: {default: '#faf9ff', paper: '#ffffff'},
  },
  shape: {borderRadius: 16},
  typography: {fontSize: 15, fontFamily: '"Nunito", "Segoe UI", system-ui, sans-serif'},
  components: {
    MuiTableCell: {styleOverrides: {root: {padding: '16px 20px', borderBottom: '1px solid #efeaff'}}},
    MuiTableRow: {styleOverrides: {root: {'&:hover': {backgroundColor: '#f5f1ff'}}}},
  },
});

/** One list, so the toolbar and the decorator can never disagree about what exists. */
const THEME_PRESETS = [
  {id: 'light', title: 'Light (stock MUI)', theme: lightTheme},
  {id: 'dark', title: 'Dark (stock MUI)', theme: darkTheme},
  {id: 'branded', title: 'Branded (host app overrides)', theme: brandedTheme},
  {id: 'brandedDark', title: 'Branded dark', theme: brandedDarkTheme},
  {id: 'highContrast', title: 'High contrast', theme: highContrastTheme},
  {id: 'dense', title: 'Sharp and dense', theme: denseTheme},
  {id: 'soft', title: 'Soft and spacious', theme: softTheme},
] as const;

const THEMES: Record<string, Theme> = Object.fromEntries(THEME_PRESETS.map((preset) => [preset.id, preset.theme]));

/**
 * Renders the small subset of Markdown that story descriptions actually use: paragraphs,
 * dash bullets, `code` and **bold**.
 *
 * Storybook does export a `Markdown` block, but importing it here pulls the docs runtime
 * into the preview bundle and every story then fails to render. Twenty lines is the cheaper
 * trade.
 */
function inline(text: string, keyPrefix: string) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Box key={key} component="code" sx={{fontFamily: 'monospace', fontSize: '0.85em'}}>
          {part.slice(1, -1)}
        </Box>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    return <span key={key}>{part}</span>;
  });
}

/**
 * Puts a story's own description above it in the canvas.
 *
 * Storybook shows the JSDoc over a story on the docs page and nowhere else, so someone
 * clicking through the sidebar sees a component with no statement of what it is
 * demonstrating. This is the same text, in the place they are actually looking. The docs
 * page already renders it, so it is skipped there.
 */
function StoryNote({text}: {readonly text: string}) {
  // A blank line separates blocks; a run of dash-prefixed lines is one list.
  const blocks = text.split(/\n\s*\n/).filter(Boolean);

  return (
    <Box
      sx={{
        mb: 2,
        px: 2,
        py: 1.5,
        borderLeft: 3,
        borderColor: 'primary.main',
        bgcolor: 'action.hover',
        borderRadius: 1,
      }}
    >
      <Typography component="p" variant="overline" sx={{display: 'block', color: 'text.secondary', lineHeight: 1.6}}>
        What this story shows
      </Typography>

      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n');

        if (lines.every((line) => line.trimStart().startsWith('-'))) {
          return (
            <Typography
              key={`block-${blockIndex}`}
              component="ul"
              variant="body2"
              sx={{color: 'text.primary', my: 0.5, pl: 3}}
            >
              {lines.map((line, lineIndex) => (
                <li key={`item-${blockIndex}-${lineIndex}`}>
                  {inline(line.trimStart().replace(/^-\s*/, ''), `i-${blockIndex}-${lineIndex}`)}
                </li>
              ))}
            </Typography>
          );
        }

        return (
          <Typography key={`block-${blockIndex}`} component="p" variant="body2" sx={{color: 'text.primary', my: 0.5}}>
            {inline(block.replace(/\n/g, ' '), `p-${blockIndex}`)}
          </Typography>
        );
      })}
    </Box>
  );
}

const preview: Preview = {
  parameters: {
    controls: {matchers: {color: /(background|color)$/i, date: /Date$/i}},
    // Read order, not alphabetical: what this is, then how to set it up, then the component.
    options: {storySort: {order: ['Introduction', 'Guides', ['Getting started', 'Server-side data', 'Theming']]}},
    a11y: {
      // Fail the story in the Vitest run rather than only flagging it in the panel.
      test: 'error',
    },
    // The table swaps to a card list below its `mobileBreakpoint`, so "does this work on a
    // phone" is a real question with a real answer rather than a guess about a resize. The
    // toolbar's device list drives it; `MobileCards` pins itself to one.
    viewport: {options: INITIAL_VIEWPORTS},
    docs: {
      // Props a story does not showcase are hidden per story, so what is left in the table
      // is the subject of that story. Required props first, since those are the ones a
      // consumer copying the snippet has to supply.
      controls: {sort: 'requiredFirst'},
    },
  },
  globalTypes: {
    theme: {
      description: 'Host app theme. Every story repaints; the package hardcodes nothing.',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: THEME_PRESETS.map((preset) => ({value: preset.id, title: preset.title})),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {theme: 'light'},
  decorators: [
    (Story, context) => {
      // The same string the docs page renders, read back out of the story's parameters.
      // Nothing to keep in sync: the JSDoc over the story is still the only source.
      const note: unknown = context.parameters.docs?.description?.story;

      return (
        <ThemeProvider theme={THEMES[String(context.globals.theme)] ?? lightTheme}>
          <CssBaseline />
          {context.viewMode !== 'docs' && typeof note === 'string' && <StoryNote text={note} />}
          <Story />
        </ThemeProvider>
      );
    },
  ],
};

export default preview;
