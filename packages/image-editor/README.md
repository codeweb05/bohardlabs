# @vt-labs/image-editor

A MUI dialog that crops, rotates, flips, straightens and adjusts one image, then hands back a
`File` that already fits your upload rules. It is for apps on React 19 and MUI 9 that take
avatars, cover photos or product shots and would rather not ship a server-side resize step.

Every tool is on by default: crop, zoom, rotate, flip, straighten, brightness, contrast,
saturation, presets, undo and redo, and a Replace button. Pass `false` for the ones you do not
want, so an avatar picker can be as small as crop and zoom. Below the `sm` breakpoint the dialog goes full screen, with the
quick tools in a floating pill over the image.

> **Status: 0.1.0.** The first release. Until 1.0, a minor version may change the API.

## Install

Everything the package uses is a peer, so your app's copy of React and MUI is the only one in
the bundle. The crop engine, [cropperjs 2](https://github.com/fengyuanchen/cropperjs), is
imported only when the dialog first opens, never at module load or on the server.

```sh
pnpm add @vt-labs/image-editor cropperjs @mui/material @mui/icons-material @emotion/react @emotion/styled
```

## An avatar

```tsx
import {ImageEditor} from '@vt-labs/image-editor';

export function AvatarEditor({file, onDone}: {readonly file: File | null; readonly onDone: () => void}) {
  return (
    <ImageEditor
      open={file !== null}
      source={file}
      onClose={onDone}
      onApply={async ({file: avatar}) => {
        await uploadAvatar(avatar);
        onDone();
      }}
      features={{crop: {shape: 'circle'}, straighten: false, adjust: false}}
      output={{type: 'image/png', maxWidth: 256, maxHeight: 256}}
    />
  );
}
```

`source` takes a `File`, a `Blob` or a URL. Pass `null` and the dialog opens on its own drop
zone and file picker. While the promise from `onApply` is pending the dialog shows it is busy.
If the promise rejects, the dialog stays open with the edits intact and says the save failed.

## Features

Every entry in `features` is `boolean | options`. `false` removes the tool and its controls.
`true` uses the defaults.

| Feature      | Default | Options                                                                                                       |
| ------------ | :-----: | ------------------------------------------------------------------------------------------------------------- |
| `crop`       |   on    | `ratios` (`'free'`, `'1:1'`, `'4:3'`, `'16:9'` or a number; the first is the starting one), `shape: 'circle'` |
| `zoom`       |   on    | `min`, `max` (1 is the largest crop), `slider: false` to hide the visible control                             |
| `rotate`     |   on    | 90° steps                                                                                                     |
| `flip`       |   on    | `horizontal`, `vertical`                                                                                      |
| `straighten` |   on    | `range` in degrees, default 45                                                                                |
| `adjust`     |   on    | `brightness`, `contrast`, `saturation`, `presets`; turns on an Adjust tab                                     |
| `history`    |   on    | Undo and Redo buttons, and Ctrl/Cmd+Z                                                                         |
| `replace`    |   on    | A Replace image button that opens the picker                                                                  |

Adjustments need `CanvasRenderingContext2D.filter`. Where a browser lacks it, the Adjust tab
does not appear.

## Upload rules

`input` checks the source before it is shown: `accept` (MIME types, default JPEG, PNG, WebP and
GIF), `minWidth`, `minHeight` and `maxBytes`. A source that fails is reported through
`onError` with a code and a message in the dialog.

`output` shapes the file you get back:

- `type`: JPEG, PNG or WebP. By default the source's type, or PNG for a circle or an
  unsupported source.
- `maxWidth`, `maxHeight`: the crop is scaled down to fit, never up.
- `maxBytes`: the editor lowers a lossy type's quality (never below 0.6), then shrinks the
  image until the file fits. If it cannot fit without going under 64 px, `onError` receives
  `output-too-large`. A file over the limit is never returned.
- `quality`, `background` (fills a circle's corners when the type has no transparency) and
  `fileName`.

`onApply` receives `{file, width, height, type}`. `type` is what the browser actually
produced, which can differ from `output.type` where a browser cannot encode WebP.

## Keyboard and screen readers

The image area is focusable. Arrows move the crop (Alt for a finer step), Shift+arrows resize
it, `+` and `-` zoom, `r` and `R` rotate, and Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo and redo
unless history is off. Each change is announced in a polite live region.

## Labels

Every string is a label with an English default. Pass the ones you want to change:

```tsx
<ImageEditor labels={{title: 'Recadrer la photo', apply: 'Appliquer', rotated: (d) => `Pivoté de ${d}°`}} … />
```

`DEFAULT_IMAGE_EDITOR_LABELS` holds the full set, and `ImageEditorLabels` is its type. The
error messages are labels too (`errorTooSmall`, `errorOutputTooLarge`, and the rest).

## Theming

Colours come from your theme: the crop handles and the active drop zone use `primary.main`,
the borders use `divider`, and the image sits on `grey.900` in either mode. The Storybook showcase renders every story under plain MUI
light and dark themes.
