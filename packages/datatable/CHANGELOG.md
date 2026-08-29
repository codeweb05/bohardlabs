# @bohardlabs/datatable

## 0.1.0

### Minor Changes

- Supports MUI 9 and MUI X Date Pickers 9. The peer ranges widen rather than move, so an app
  still on MUI 7 and pickers 8 keeps working and can upgrade on its own schedule.
  `write-excel-file` 4 is accepted alongside 3 the same way.

  Two things a consumer can see:

  The date filter's two inputs are now told apart by their accessible name instead of a
  placeholder. Pickers 9 always renders the accessible sectioned field, which has no
  placeholder to put a name in, so `labels.from` and `labels.to` feed `aria-label` now. A
  test that located those inputs by placeholder text should switch to
  `getByLabelText(/from/i)`. Apps still on pickers 8 lose the visible placeholder text and
  gain the accessible name.

  The error state's icon changed from `ErrorOutline` to `ErrorOutlined`, which MUI 9 renamed.
  The glyph is the same; the generated `data-testid` is `ErrorOutlinedIcon`.

- `ConfirmDialog` is now exported. It is the dialog the table already puts in front of a
  destructive bulk action, so an app that confirms deletions on its own detail pages can use
  the same one instead of building a near-match.

  ```tsx
  import {ConfirmDialog} from '@bohardlabs/datatable';

  <ConfirmDialog
    open={isConfirming}
    onClose={() => setIsConfirming(false)}
    onConfirm={() => deleteOrder(id)}
    title="Delete order"
    message="This cannot be undone."
    confirmLabel="Delete"
    confirmColor="error"
  />;
  ```

  It needs no `DataTable` above it: the two button labels fall back to `DEFAULT_LABELS`, and
  `confirmLabel` / `cancelLabel` override them. Its props are `DataTableConfirmProps`, which
  is also the `slots.confirmDialog` contract, so a wrapper that fixes `confirmColor` for the
  app can be passed straight back in as the slot.

  Two fixes came with it, both visible to anyone already using the built-in dialog through
  bulk actions:

  The confirm button keeps its accessible name while the action runs. The spinner replaces the
  label, which left the button unnamed for the length of the action (axe reported
  `button-name`), and made `getByRole('button', {name: 'Delete'})` stop matching partway
  through a test. The button now carries the label as an `aria-label` and `aria-busy` while it
  runs, and the spinner is hidden from assistive tech.

  A rejected `onConfirm` no longer surfaces as an unhandled rejection. Reporting the error is
  still the caller's job; the dialog only re-enables itself so the action can be retried or
  cancelled.

### Patch Changes

- 4b95573: Export no longer leaves an unlabelled link in the tab order. The anchor the download
  goes through was appended to the page visible and focusable, so for 100ms after every
  CSV or JSON export a keyboard user could tab onto a link with no accessible name, and
  axe reported a `link-name` violation. It is now hidden.
