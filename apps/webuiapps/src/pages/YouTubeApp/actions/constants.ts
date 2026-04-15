/**
 * YouTubeApp constants
 *
 * Actions represent methods the Agent can invoke on the App.
 * v1 only exposes SEARCH — Kayley sends a query and the App renders
 * a grid of clickable result cards.
 */

export const APP_ID = 3;
export const APP_NAME = 'youtube';

// Operation Actions — App directly executes the corresponding method
export const OperationActions = {
  SEARCH: 'SEARCH',
} as const;

// All Action Types
export const ActionTypes = {
  ...OperationActions,
} as const;

// Defaults
export const DEFAULT_MAX_RESULTS = 10;
export const MAX_MAX_RESULTS = 25;
