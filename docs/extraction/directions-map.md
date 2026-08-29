# Proposal: `@bohardlabs/directions-map`

**Status:** deferred, 2026-08-28. **Source:** `skipwash-admin/src/components/DirectionsMap/`
(918 loc across 7 files) plus `src/lib/google-maps/` (35). **Apps using it:** 1 of 4.

## What it is

A route planner. A Google map with a directions polyline and numbered stop markers on one
side, a drag-to-reorder stop list on the other, and a timing cascade underneath that
recomputes every stop's arrival from the leg durations the Directions API returns.

The parts:

| File                | LOC | What it does                                            |
| ------------------- | --: | ------------------------------------------------------- |
| `MapPanel.tsx`      | 282 | The map, markers, info windows, bounds fitting          |
| `StopListPanel.tsx` | 174 | The list, the dnd-kit context, the layout toggle        |
| `StopListItem.tsx`  | 170 | One row: drag handle, timing, warning state, remove     |
| `DirectionsMap.tsx` | 155 | Composition, reorder handling, the split/stacked switch |
| `useTimeCascade.ts` | 126 | Arrival, departure and lateness per stop                |
| `useDirections.ts`  |  72 | Debounced `DirectionsService` calls, waypoint assembly  |
| `markerUtils.ts`    |  37 | Numbered marker icons                                   |

The timing cascade is the interesting part and the reason this is on the list at all.
Given a start time, a per-stop dwell time and the leg durations, it produces each stop's
anticipated arrival and departure, decides whether that falls inside the stop's expected
window, and flags early and late separately. It is pure, it has no Google dependency, and
it is the piece someone would get subtly wrong on a reimplementation.

## Why it is deferred

**One consumer, and the consumer is a domain.** Route instances with stops, dwell times and
expected arrival windows is a logistics product feature. The other three admin forks have no
map at all. Publishing this is publishing one product's screen.

**The generic surface is better than the survey first credited.** Worth correcting on the
record: `DirectionsStop<T>` is already generic with a `data: T` escape hatch, `renderInfoWindow`
is already a render prop, and marker configuration is already per-stop. The whole directory
imports exactly three app modules: `useGoogleMaps` (for the env API key),
`formatScheduleTimeWindow` and `useTranslation`. The decoupling work is small.

So the objection is not coupling. It is that a package needs a second consumer to tell you
which of its current choices are the API and which are one screen's preferences, and there
is no second consumer.

**The peer matrix is heavy for one screen's worth of reuse.** `@react-google-maps/api`,
four `@dnd-kit` packages and `dayjs`, all of which the consumer must hold, all of which must
match. A consumer who wants the timing cascade and not the map still pays for the peer
declarations.

**It cannot be tested the way everything else here is tested.** Google Maps needs a real API
key and a network. `MapPanel` and `useDirections` would be mock-only, and the stories, the
part of this repo that doubles as the test suite, would render an empty grey box in CI.
Shipping a UI package whose main component has no story is shipping a package nobody can
evaluate before installing it.

## What would change the answer

- A second app needs route planning. That is the real trigger.
- Google Maps stops being the assumption. If a Mapbox or MapLibre variant is ever needed,
  the provider seam has to exist, and building that seam is most of the extraction work
  anyway.

## The piece that could go now

`useTimeCascade` is 126 lines of pure arithmetic with no Google dependency, no React
dependency beyond `useMemo`, and one `dayjs` call. It is fully testable, and the questions
it answers, when does this stop get served, is that inside its window, how late is the route
running, are not specific to maps.

If a scheduling feature in another app needs the same arithmetic, extract it alone as
`@bohardlabs/schedule-timing` and leave the map behind. That is a 130-line package with real
tests and no peer matrix, which is a very different proposition from a 950-line package with
six peers and no stories.

## Recommendation

Leave it in the app. Revisit if a second consumer appears. If only the arithmetic is wanted,
extract `useTimeCascade` on its own rather than the directory.
