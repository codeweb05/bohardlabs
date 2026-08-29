import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import {ThemeProvider} from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type {Preview} from '@storybook/react-vite';
import {INITIAL_VIEWPORTS} from 'storybook/viewport';

import {StorySource} from './StorySource';
import {DEFAULT_THEME, THEME_PRESETS, THEMES} from './themes';

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
      // The fallback only. `StorySource` prefers the JSX string `jsxDecorator` puts on the
      // channel, which is what the docs page shows; this is what `csf-plugin` wrote at build
      // time, and it is the story object rather than a component call.
      const source: unknown = context.parameters.docs?.source?.originalSource;
      // The docs page renders both of these itself, above and below each embedded story.
      const isCanvas = context.viewMode !== 'docs';

      return (
        <ThemeProvider theme={THEMES[String(context.globals.theme)] ?? DEFAULT_THEME}>
          <CssBaseline />
          {isCanvas && typeof note === 'string' && <StoryNote text={note} />}
          <Story />
          {isCanvas && typeof source === 'string' && <StorySource storyId={context.id} originalSource={source} />}
        </ThemeProvider>
      );
    },
  ],
};

export default preview;
