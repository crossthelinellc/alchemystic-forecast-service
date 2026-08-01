# Alchemystic universal forecast engine

This integration calculates Mystic Rebels' universal forecast using the rules in
`docs/alchemystic-universal-forecast-spec.md`.

`engine.mjs` is deliberately independent of any ephemeris package. An ephemeris adapter supplies
timestamped tropical longitudes and apparent longitudinal speeds; the engine owns Alchemystic
direction, OOI, True Aspect, Forced Aspect, Fringe, and Aspect Arc classification.

`forecast-scanner.mjs` samples the complete Universal ecosystem, preserves a seven-day focus inside
a configurable scan, and refines activation, exactitude, and release timestamps to one minute by
default. The production service scans a buffered 120-day interval so it can emit complete arcs for
the prior 30 days through the next 30 days.

`interpretation-engine.mjs` builds the mandatory pre-writing context for each transit. It assesses
both planets separately, their active Channels, sign Through Points, modern rulers and Delegates,
then separates the focus planets' direct aspect and rulership **With** layers from indirect,
concurrent **While** layers. It also groups scanner
events into Aspect Arc records so Activating, True Aspect/Forced Aspect shifts, Point of Exactitude, the directional handoff, and
Releasing can always be retrieved together.

Approved editorial records must carry an `alchemystic-interpretation.v1` method record containing
planet one's assessed condition, planet two's separately assessed condition, and an aspect synthesis
whose body and aspect keys match the calculated arc. The feed fails closed at the interpretation
boundary: a missing or mismatched assessment leaves the factual calendar arc available but suppresses
the prose. This prevents an isolated aspect meaning from being presented as an Alchemystic reading.

`forecast-feed.mjs` converts complete Aspect Arcs into the versioned JSON contract consumed by the
Shopify sections. The homepage `week` collection includes approved editorial interpretations; the
rolling `calendar` collection retains calculated arcs whether or not editorial copy is available.
Unapproved records are clearly marked as calculated timing only instead of receiving invented
forecast language.

`forecast-service.mjs` serves that contract at `/api/alchemystic-forecast`, caches calculations for
six hours, coalesces simultaneous requests, supports ETags, and restricts browser access to Mystic
Rebels storefront origins. It requires `SWETEST_BIN`, `SWISSEPH_PATH`, and
`ALCHEMYSTIC_EDITORIAL_JSON` or `ALCHEMYSTIC_EDITORIAL_PATH`; the editorial JSON is keyed by each
directional Aspect Arc key. Under the current AGPL model, `ALCHEMYSTIC_SOURCE_URL` is also required
and the service refuses to start unless it is a public HTTPS corresponding-source location.

The included `Dockerfile` builds `swetest` from the pinned official 2.10.03 source, downloads the
three required ephemeris files from a pinned official repository revision, and verifies their
SHA-256 checksums. Build it from the repository root so the forecast integration is the only theme
source copied into the runtime image; its Dockerfile-specific ignore rules also keep the rest of
the private theme out of the build context.

`generate-static-feed.mjs` runs the same production service contract once and writes a Pages-ready
artifact at `dist/api/alchemystic-forecast.json`. The public source repository runs it on a
three-hour schedule using a standard GitHub-hosted runner. Store-approved interpretations belong in
`editorial.json`; until an Aspect Arc has approved copy there, it remains available as factual
calendar timing but is not promoted into the interpreted homepage week.

Run the current contract tests with:

```sh
node --test integrations/alchemystic-forecast/*.test.mjs
```

## Ephemeris licensing boundary

Mystic Rebels selected the AGPL edition for the initial service and intends to activate the Swiss
Ephemeris Professional License when commercial scale warrants it. See `LICENSE-NOTICE.md`.

The service remains separate from the Shopify theme and exposes calculated forecast JSON over
HTTP. `swetest-provider.mjs` calls the official `swetest` executable and refuses output containing
warnings or errors, preventing missing ephemeris files from silently falling back to approximate
or zero-valued positions.

Local integration verification requires the official Swiss Ephemeris 2.10.3 `swetest` binary and
the current `sepl_18.se1`, `semo_18.se1`, and `seas_18.se1` data files:

```sh
SWETEST_BIN=/path/to/swetest \
SWISSEPH_PATH=/path/to/ephe \
node --test integrations/alchemystic-forecast/*.test.mjs
```
