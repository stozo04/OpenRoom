/**
 * YouTubeApp type definitions
 *
 * A YouTube search result card. Kayley dispatches youtube/SEARCH via
 * vibe_action, the component performs the actual search, and renders
 * each result as a clickable card that embeds the YouTube player.
 */

export interface YouTubeSearchResult {
  video_id: string;
  title: string;
  channel: string;
  thumbnail_url: string;
  /** Human-readable duration string (e.g. "4:02"). Absent for live streams. */
  duration?: string;
}

export interface YouTubeAppState {
  query: string;
  results: YouTubeSearchResult[];
  isSearching: boolean;
  error: string | null;
  /** video_id of currently playing embed, or null when showing the results grid. */
  playingVideoId: string | null;
}
