import CheckIcon from '@mui/icons-material/Check';
import CodeIcon from '@mui/icons-material/Code';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import {useEffect, useId, useState} from 'react';
import {getChannel} from 'storybook/preview-api';

import {describeStory, loadStoryFile} from './storyCode';

/**
 * The event `@storybook/react`'s `jsxDecorator` fires once it has turned the rendered story
 * into a JSX string, and the one the docs page's Show code listens to. Spelled out rather
 * than imported: the constant lives in `storybook/internal/docs-tools`, and an internal
 * entrypoint is a worse dependency than a string with a comment over it.
 */
const SNIPPET_RENDERED = 'storybook/docs/snippet-rendered';

interface SnippetEvent {
  readonly id?: unknown;
  readonly source?: unknown;
}

/**
 * Snippets arrive on the channel, not from a render, and they arrive per story id. Holding
 * them here rather than in component state means a story that emitted before this block
 * mounted is still available to it, and that switching back to a story does not wait for a
 * re-render to get its code back.
 */
const snippets = new Map<string, string>();
const listeners = new Set<() => void>();
let isSubscribed = false;

function subscribeOnce() {
  if (isSubscribed) return;

  // Typed as nullable because the preview can import this module before the channel is set.
  // Leaving `isSubscribed` false means the next story to mount tries again.
  const channel = getChannel();
  if (!channel) return;
  isSubscribed = true;

  channel.on(SNIPPET_RENDERED, ({id, source}: SnippetEvent) => {
    if (typeof id !== 'string' || typeof source !== 'string' || source.length === 0) return;
    snippets.set(id, source);
    for (const notify of listeners) notify();
  });
}

/**
 * The JSX the docs page shows for this story, once it exists.
 *
 * `jsxDecorator` re-renders the story with its current args and stringifies the result, so
 * this is the component call a reader can paste, with the args they have set in the Controls
 * panel. It is `null` when the decorator declined to run: a story with `docs.source.type`
 * set to `code`, and every story in the Vitest run, where `__isPortableStory` skips it.
 */
function useSnippet(storyId: string): string | null {
  const [snippet, setSnippet] = useState<string | null>(null);

  useEffect(() => {
    subscribeOnce();

    const read = () => setSnippet(snippets.get(storyId) ?? null);
    read();
    listeners.add(read);
    return () => {
      listeners.delete(read);
    };
  }, [storyId]);

  return snippet;
}

/**
 * The text of the file the story lives in, fetched the first time its code is asked for.
 * `null` until it arrives, and for a story whose file cannot be found.
 */
function useStoryFile(fileName: string | null, isWanted: boolean): string | null {
  const [loaded, setLoaded] = useState<{readonly fileName: string; readonly text: string | null} | null>(null);

  useEffect(() => {
    if (!isWanted || fileName === null) return;

    let isCurrent = true;
    const load = async () => {
      const text = await loadStoryFile(fileName);
      if (isCurrent) setLoaded({fileName, text});
    };
    void load();
    return () => {
      isCurrent = false;
    };
  }, [fileName, isWanted]);

  return loaded?.fileName === fileName ? loaded.text : null;
}

/**
 * The story's code, under the story, with a copy button.
 *
 * Storybook puts this on the docs page and nowhere else, so someone clicking through the
 * sidebar sees a working table and no way to get the code that made it without changing
 * views. It goes in the place they are looking, for the same reason `StoryNote` puts the
 * description there, and it says more than the docs page does: a story built on a demo
 * component shows that component too. `storyCode.ts` has the reasoning.
 *
 * Collapsed until asked for: an open code block under every story would double the height of
 * the canvas, and its text would sit inside the same root the `play` functions and the axe
 * pass read, where it can only add noise. `unmountOnExit` keeps it out of the DOM entirely
 * until it is opened.
 */
export function StorySource({
  storyId,
  originalSource,
  fileName,
}: {
  readonly storyId: string;
  readonly originalSource: string;
  readonly fileName: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const regionId = useId();

  const snippet = useSnippet(storyId);
  const file = useStoryFile(fileName, isOpen);
  const source = describeStory({snippet, originalSource, file});

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setHasCopied(true);
      window.setTimeout(() => setHasCopied(false), 1500);
    } catch {
      // Clipboard access can be refused (an insecure origin, a denied permission). Saying
      // nothing is better than a toast the story did not ask for; the code is still on
      // screen to select by hand.
      setHasCopied(false);
    }
  };

  return (
    <Box
      sx={{
        mt: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.5}}>
        <Button
          size="small"
          startIcon={<CodeIcon />}
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls={regionId}
          sx={{color: 'text.secondary'}}
        >
          {isOpen ? 'Hide code' : 'Show code'}
        </Button>

        <Button
          size="small"
          startIcon={hasCopied ? <CheckIcon /> : <ContentCopyIcon />}
          onClick={copy}
          sx={{color: 'text.secondary'}}
        >
          {hasCopied ? 'Copied' : 'Copy'}
        </Button>
      </Box>

      <Collapse in={isOpen} unmountOnExit>
        <Box
          id={regionId}
          component="pre"
          sx={{
            m: 0,
            px: 2,
            py: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'action.hover',
            color: 'text.primary',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '0.75rem',
            lineHeight: 1.6,
            // A story's code now carries the definitions it leans on, which can run long.
            maxHeight: '60vh',
            overflow: 'auto',
          }}
        >
          {source}
        </Box>
      </Collapse>
    </Box>
  );
}
