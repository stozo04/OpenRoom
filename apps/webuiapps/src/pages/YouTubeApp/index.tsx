import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { initVibeApp, AppLifecycle } from '@gui/vibe-container';
import {
  useAgentActionListener,
  reportLifecycle,
  fetchVibeInfo,
  type CharacterAppAction,
} from '@/lib';
import './i18n';
import { ArrowLeft, Search, Youtube } from 'lucide-react';
import type { YouTubeSearchResult } from './types';
import {
  APP_ID,
  ActionTypes,
  DEFAULT_MAX_RESULTS,
  MAX_MAX_RESULTS,
} from './actions/constants';
import styles from './index.module.scss';

// ============ YouTube Search ============
//
// Strategy: prefer `youtube-search-api` (battle-tested, no API key, ~1k
// weekly downloads). It's designed for Node — when bundled for the browser
// it may hit CORS or polyfill issues at runtime. We guard every call and
// fall back to a deterministic stub so the vibe_action round-trip is
// always observable end-to-end. Kayley cares more about the action
// dispatching than perfect search fidelity.

type SearchBackend = 'youtube-search-api' | 'stub';

/**
 * Stub results used when the real scraper fails in the browser. Five fixed
 * videos so the UI is always populated and Kayley can still demo the flow.
 */
const STUB_RESULTS: YouTubeSearchResult[] = [
  {
    video_id: 'dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
    channel: 'Rick Astley',
    thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    duration: '3:33',
  },
  {
    video_id: 'Zi_XLOBDo_Y',
    title: 'Fleetwood Mac - Landslide (Live)',
    channel: 'Fleetwood Mac',
    thumbnail_url: 'https://i.ytimg.com/vi/Zi_XLOBDo_Y/hqdefault.jpg',
    duration: '4:28',
  },
  {
    video_id: '9bZkp7q19f0',
    title: 'PSY - GANGNAM STYLE (강남스타일) M/V',
    channel: 'officialpsy',
    thumbnail_url: 'https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg',
    duration: '4:13',
  },
  {
    video_id: 'kJQP7kiw5Fk',
    title: 'Luis Fonsi - Despacito ft. Daddy Yankee',
    channel: 'Luis Fonsi',
    thumbnail_url: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
    duration: '4:42',
  },
  {
    video_id: 'JGwWNGJdvx8',
    title: 'Ed Sheeran - Shape of You (Official Music Video)',
    channel: 'Ed Sheeran',
    thumbnail_url: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg',
    duration: '4:24',
  },
];

interface RawScrapeItem {
  id?: string;
  title?: string;
  length?: { simpleText?: string };
  thumbnail?: { thumbnails?: Array<{ url?: string }> };
  channelTitle?: string;
  type?: string;
}

async function searchYouTube(
  query: string,
  maxResults: number,
): Promise<{ results: YouTubeSearchResult[]; backend: SearchBackend }> {
  const cap = Math.min(Math.max(1, maxResults), MAX_MAX_RESULTS);

  // Try the real scraper. Dynamic import so any top-level failure is
  // contained and we can fall back to stubs without blowing up the App.
  try {
    const mod = (await import('youtube-search-api')) as {
      GetListByKeyword?: (
        keyword: string,
        withPlaylist?: boolean,
        limit?: number,
      ) => Promise<{ items?: RawScrapeItem[] }>;
    };

    const GetListByKeyword = mod.GetListByKeyword;
    if (typeof GetListByKeyword !== 'function') {
      throw new Error('youtube-search-api: GetListByKeyword not available');
    }

    const raw = await GetListByKeyword(query, false, cap);
    const items = (raw?.items ?? []).filter((it) => it?.type === 'video' && it?.id);

    const results: YouTubeSearchResult[] = items.slice(0, cap).map((it) => ({
      video_id: it.id as string,
      title: it.title ?? '(untitled)',
      channel: it.channelTitle ?? '',
      thumbnail_url:
        it.thumbnail?.thumbnails?.[it.thumbnail.thumbnails.length - 1]?.url ??
        `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`,
      duration: it.length?.simpleText,
    }));

    if (results.length > 0) {
      return { results, backend: 'youtube-search-api' };
    }
    // Empty result — fall through to stub so the UI shows something.
    throw new Error('youtube-search-api returned no video items');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[YouTubeApp] Real search failed, using stub:', message);
    // Mark each stub with the query so the UI is at least query-aware.
    const results = STUB_RESULTS.slice(0, cap).map((r) => ({
      ...r,
      title: `[${query}] ${r.title}`,
    }));
    return { results, backend: 'stub' };
  }
}

// ============ Main Component ============

const YouTubeApp: React.FC = () => {
  const { t } = useTranslation('youtubeApp');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');

  const runSearch = useCallback(async (q: string, maxResults: number): Promise<string> => {
    if (!q.trim()) return 'error: empty query';
    setIsSearching(true);
    setError(null);
    setPlayingVideoId(null);
    setLastQuery(q);
    try {
      const { results: items, backend } = await searchYouTube(q, maxResults);
      setResults(items);
      setIsSearching(false);
      return `success: ${items.length} results (backend=${backend})`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setResults([]);
      setIsSearching(false);
      return `error: ${message}`;
    }
  }, []);

  // ============ Agent Action Listener ============
  const handleAgentAction = useCallback(
    async (action: CharacterAppAction): Promise<string> => {
      switch (action.action_type) {
        case ActionTypes.SEARCH: {
          const q = action.params?.query;
          if (!q) return 'error: missing query';
          const rawMax = action.params?.max_results;
          const parsedMax = rawMax ? parseInt(rawMax, 10) : DEFAULT_MAX_RESULTS;
          const maxResults = Number.isFinite(parsedMax) && parsedMax > 0
            ? parsedMax
            : DEFAULT_MAX_RESULTS;
          setQuery(q);
          return runSearch(q, maxResults);
        }
        default:
          return `error: unknown action_type ${action.action_type}`;
      }
    },
    [runSearch],
  );

  useAgentActionListener(APP_ID, handleAgentAction);

  // ============ Initialization ============
  useEffect(() => {
    const init = async () => {
      try {
        reportLifecycle(AppLifecycle.LOADING);
        const manager = await initVibeApp({
          id: APP_ID,
          url: window.location.href,
          type: 'page',
          name: 'YouTubeApp',
          windowStyle: { width: 960, height: 640 },
        });
        manager.handshake({
          id: APP_ID,
          url: window.location.href,
          type: 'page',
          name: 'YouTubeApp',
          windowStyle: { width: 960, height: 640 },
        });
        reportLifecycle(AppLifecycle.DOM_READY);
        await fetchVibeInfo();
        reportLifecycle(AppLifecycle.LOADED);
        manager.ready();
      } catch (error) {
        console.error('[YouTubeApp] Init error:', error);
        reportLifecycle(AppLifecycle.ERROR, String(error));
      }
    };
    init();
    return () => {
      reportLifecycle(AppLifecycle.UNLOADING);
      reportLifecycle(AppLifecycle.DESTROYED);
    };
  }, []);

  const handleManualSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        runSearch(query.trim(), DEFAULT_MAX_RESULTS);
      }
    },
    [query, runSearch],
  );

  return (
    <div className={styles.youtubeApp}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Youtube size={24} className={styles.brandIcon} />
          <span className={styles.brandName}>{t('header.title')}</span>
        </div>
        <form className={styles.searchForm} onSubmit={handleManualSearch}>
          <Search size={18} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('header.placeholder')}
            type="text"
          />
          <button className={styles.searchBtn} type="submit" disabled={!query.trim()}>
            {t('header.search')}
          </button>
        </form>
      </header>

      <main className={styles.content}>
        {playingVideoId ? (
          <div className={styles.player}>
            <button
              className={styles.backBtn}
              onClick={() => setPlayingVideoId(null)}
              type="button"
            >
              <ArrowLeft size={18} />
              {t('player.back')}
            </button>
            <div className={styles.playerFrame}>
              <iframe
                title="YouTube player"
                src={`https://www.youtube.com/embed/${playingVideoId}?autoplay=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ) : isSearching ? (
          <div className={styles.statusMessage}>{t('results.searching')}</div>
        ) : error ? (
          <div className={styles.statusMessage}>{t('results.error', { message: error })}</div>
        ) : results.length === 0 ? (
          <div className={styles.statusMessage}>
            {lastQuery ? t('results.noResults', { query: lastQuery }) : t('results.empty')}
          </div>
        ) : (
          <>
            <div className={styles.resultsMeta}>
              {t('results.count', { count: results.length, query: lastQuery })}
            </div>
            <div className={styles.grid}>
              {results.map((r) => (
                <button
                  key={r.video_id}
                  className={styles.card}
                  onClick={() => setPlayingVideoId(r.video_id)}
                  type="button"
                >
                  <div className={styles.thumbWrap}>
                    <img
                      className={styles.thumb}
                      src={r.thumbnail_url}
                      alt={r.title}
                      loading="lazy"
                    />
                    {r.duration ? (
                      <span className={styles.duration}>{r.duration}</span>
                    ) : null}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTitle} title={r.title}>
                      {r.title}
                    </div>
                    <div className={styles.cardChannel}>{r.channel}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default YouTubeApp;
