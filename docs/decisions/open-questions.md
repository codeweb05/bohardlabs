# Open questions

Decisions not yet made. Nothing here is an oversight, and nothing here should be answered
by guessing. If work is blocked on one, ask.

When one is answered it leaves this file and becomes the next numbered entry in the
[decision log](README.md). Answered questions do not stay here with a "decided" line.

---

## A. The default palette's contrast

MUI's `primary.main` at 13px on the tints the table paints it against (the active-filter
chip, and the bulk bar's outlined buttons on their 6% primary wash) measures 4.26:1, under
the 4.5:1 axe requires. It comes from stock MUI's palette, not from a choice this component
made, so darkening those labels is a decision about the library's default look.

Until it is made, the `color-contrast` rule is switched off on the two stories where it
fires, and only that rule, so a new violation still fails.

**Options:** darken the two labels in the component's defaults, or leave stock MUI and
document that a consumer's theme owns contrast. **Blocks:** nothing today. The first
publish raises the stakes, since the default look becomes part of the contract.

---

## B. Do skipwash-api and smarthip-backend share the response envelope?

The api-client plan encodes a backend contract: the `{success, data, message}` envelope,
the flat-body fallback, the `x-tenant-id` header, the `ErrorCode` mapping and the refresh
endpoint's shape. It assumes both backends agree on all five. Nobody has checked.

**Resolves by:** reading the two backends and recording the answer in section 4 of
[`../extraction/README.md`](../extraction/README.md). **Blocks:**
[the api-client plan](../superpowers/plans/open/2026-08-28-api-client-package.md) as
written; if they disagree, the plan says which of its tasks survive.
