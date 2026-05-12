/**
 * Action type constants for the Mystery App.
 *
 * These identifiers are shared between:
 *  - the in-browser UI (dispatches via vibeContainerMock + WebSocket to the GM)
 *  - meta.yaml (which tells Kayley's brain which actions exist)
 *  - the GM subprocess at ws://localhost:5182 (pattern-matches on action_type)
 */

export const ACTION_INTERROGATE = 'INTERROGATE';
export const ACTION_EXAMINE_LOCATION = 'EXAMINE_LOCATION';
export const ACTION_COLLECT_EVIDENCE = 'COLLECT_EVIDENCE';
export const ACTION_READ_DOSSIER = 'READ_DOSSIER';
export const ACTION_MAKE_ACCUSATION = 'MAKE_ACCUSATION';

export const MYSTERY_ACTIONS = [
  ACTION_INTERROGATE,
  ACTION_EXAMINE_LOCATION,
  ACTION_COLLECT_EVIDENCE,
  ACTION_READ_DOSSIER,
  ACTION_MAKE_ACCUSATION,
] as const;

export type MysteryActionType = (typeof MYSTERY_ACTIONS)[number];

/** GM WebSocket endpoint (subprocess lives on 5185 in local dev — moved off 5182 on 2026-05-05 to coexist with dashboard API). */
export const GM_WS_URL = 'ws://localhost:5185';

/** How long we wait before retrying a dropped WebSocket connection. */
export const GM_RECONNECT_MS = 2500;

/** Response timeout — Haiku interrogations can take 30-50s; keep this above the
 *  GM subprocess's own 60s claude timeout so the frontend never races ahead. */
export const GM_RESPONSE_TIMEOUT_MS = 65000;
