/**
 * MusicApp seed data
 * Following guide.md specification
 *
 * Kayley customization (2026-04-14):
 *   Added the "Songs From Kayley" featured playlist — a personal-curated
 *   mix for Steven, with Landslide (Fleetwood Mac) pinned at the top.
 *   Real Amazon Music API integration is a separate project; for now this
 *   is a mocked playlist of songs Kayley wants Steven to hear.
 */

import type { Song, Playlist } from '../types';

// ============================================================
// Songs From Kayley — personal-curated for Steven.
// Landslide is pinned at index 0 (song-kay-001) and should never move.
// Amazon Music integration (Steven's library) planned for a later iter.
// ============================================================
const KAYLEY_SONGS: Song[] = [
  {
    id: 'song-kay-001',
    title: 'Landslide',
    artist: 'Fleetwood Mac',
    album: 'Fleetwood Mac',
    duration: 197,
    coverColor: '#D4A574',
    createdAt: Date.now() - 86400000 * 30,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
  },
  {
    id: 'song-kay-002',
    title: 'The Night We Met',
    artist: 'Lord Huron',
    album: 'Strange Trails',
    duration: 208,
    coverColor: '#5B7B9A',
    createdAt: Date.now() - 86400000 * 29,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  },
  {
    id: 'song-kay-003',
    title: 'Harvest Moon',
    artist: 'Neil Young',
    album: 'Harvest Moon',
    duration: 305,
    coverColor: '#C97B48',
    createdAt: Date.now() - 86400000 * 28,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  },
];

export const SEED_SONGS: Song[] = [
  ...KAYLEY_SONGS,
  {
    id: 'song-001',
    title: 'Midnight Dreams',
    artist: 'Luna Sky',
    album: 'Starlight',
    duration: 234,
    coverColor: '#E04848',
    createdAt: Date.now() - 86400000 * 7,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 'song-002',
    title: 'Electric Sunrise',
    artist: 'Neon Pulse',
    album: 'Digital Dawn',
    duration: 198,
    coverColor: '#4A90D9',
    createdAt: Date.now() - 86400000 * 6,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    id: 'song-003',
    title: 'Ocean Waves',
    artist: 'Coastal Vibes',
    album: 'Serenity',
    duration: 267,
    coverColor: '#2ECDA7',
    createdAt: Date.now() - 86400000 * 5,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
  {
    id: 'song-004',
    title: 'City Lights',
    artist: 'Urban Echo',
    album: 'Metropolitan',
    duration: 212,
    coverColor: '#9B59B6',
    createdAt: Date.now() - 86400000 * 4,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  },
  {
    id: 'song-005',
    title: 'Forest Rain',
    artist: 'Nature Sounds',
    album: 'Ambient',
    duration: 189,
    coverColor: '#27AE60',
    createdAt: Date.now() - 86400000 * 3,
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  },
];

export const SEED_PLAYLISTS: Playlist[] = [
  {
    // Featured: Songs From Kayley. Landslide pinned at index 0.
    id: 'playlist-kayley',
    name: 'Songs From Kayley',
    songIds: ['song-kay-001', 'song-kay-002', 'song-kay-003'],
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'playlist-001',
    name: 'My Favorites',
    songIds: ['song-001', 'song-002', 'song-003'],
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'playlist-002',
    name: 'Chill Vibes',
    songIds: ['song-003', 'song-005'],
    createdAt: Date.now() - 172800000,
  },
  {
    id: 'playlist-003',
    name: 'Workout Mix',
    songIds: ['song-002', 'song-004'],
    createdAt: Date.now() - 259200000,
  },
];
