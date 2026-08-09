import { Song } from '/@/shared/types/domain-types';

// Bounded LRU (not an unbounded Map) — a long browsing/search session over a
// large library would otherwise keep every page of full Song objects
// resident for the renderer's entire lifetime. `Map` preserves insertion
// order, so re-inserting on both write and read hits is enough to track
// recency without a separate structure. Mirrors the identical pattern in
// use-remote-library.tsx (the Electron phone-remote's own track cache) — kept
// as a separate instance rather than shared, since the two bridges are
// otherwise fully independent and sharing would couple them for no benefit.
const TRACK_CACHE_MAX_SIZE = 500;
const trackCache = new Map<string, Song>();

export function cacheTrack(song: Song): void {
    trackCache.delete(song.id);
    trackCache.set(song.id, song);
    if (trackCache.size > TRACK_CACHE_MAX_SIZE) {
        const oldestKey = trackCache.keys().next().value;
        if (oldestKey !== undefined) trackCache.delete(oldestKey);
    }
}

export function getCachedTrack(id: string): Song | undefined {
    const song = trackCache.get(id);
    if (song) {
        trackCache.delete(id);
        trackCache.set(id, song);
    }
    return song;
}
