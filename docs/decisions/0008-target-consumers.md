# 0008. The packages are for new projects, not the skipwash apps

**Status:** decided, 2026-09-29.

## Context

The [extraction survey](../extraction/README.md) and the five plans written on 2026-08-28
argued from one premise: four skipwash-family admin apps keep drifting copies of the same
components, so extracting them lets all four share one. The skipwash apps are in
production, and moving them onto new packages is not planned.

Meanwhile promptiva-backend started an admin web app (`apps/admin-web`, with shared fields
in `packages/ui-web`) on the same stack, and its own rules already say that anything
another project could install belongs in this library.

## Decision

The packages are designed for promptiva and for projects after it. The skipwash apps stay
on their own copies. Their code is reference material: it shows what a field or dialog has
to handle, not an API this repo has to keep compatible.

## What follows

- A design follows the consumer that will actually install it. For forms that means
  TanStack Form with Zod error codes, date-fns, MUI 9, and a typed contract client rather
  than the `{success, data, message}` envelope.
- A plan written as a port of skipwash code gets rewritten as a design when it is picked
  up. [The form spec](../superpowers/specs/2026-09-29-form-package-design.md) is the first.
- The roadmap's "skipwash-admin switches to the package" row no longer applies.
- [Open question B](open-questions.md#b-do-skipwash-api-and-smarthip-backend-share-the-response-envelope)
  assumed two skipwash-family backends as consumers. The session and api-client spec
  revisits it.
