import { useEffect, useRef } from 'react';

import { ConnectStatus } from './types';

import { useSendScrobble } from '/@/renderer/features/player/mutations/scrobble-mutation';
import { useAppStore } from '/@/renderer/store/app.store';
import { usePlaybackSettings } from '/@/renderer/store/settings.store';
import { QueueSong, ServerType } from '/@/shared/types/domain-types';

interface ConnectScrobbleArgs {
    connectStatus: ConnectStatus | null;
    currentSong: QueueSong | undefined;
    isActive: boolean;
    isRadioActive: boolean;
}

/**
 * Connect-specific scrobble triggers.
 *
 * The default `use-scrobble.ts` flow is gated on the local player being PLAYING
 * — which never happens during Connect playback because the local player is
 * force-paused. This hook re-implements the two scrobble events for the Connect
 * path: a "now-playing" start when a new track begins streaming, and a final
 * "submission" when the backend signals `ended=true` (track fully played).
 */
export const useConnectScrobble = ({
    connectStatus,
    currentSong,
    isActive,
    isRadioActive,
}: ConnectScrobbleArgs): void => {
    const scrobbleEnabled = usePlaybackSettings().scrobble?.enabled;
    const isPrivateMode = useAppStore((s) => s.privateMode);
    const sendScrobble = useSendScrobble();

    // Holds the song that's currently playing via Connect. Read in the
    // submission effect because by the time `ended=true` fires,
    // use-connect-playback has already called mediaNext(), advancing
    // `currentSong` to the next track.
    const playingSongRef = useRef<QueueSong | undefined>(undefined);
    const lastStartedRef = useRef<string>('');
    const lastSubmittedRef = useRef<string>('');

    // ── Start (now-playing) ───────────────────────────────────────────────
    useEffect(() => {
        if (!isActive || isRadioActive) return;
        if (!scrobbleEnabled || isPrivateMode) return;
        if (!connectStatus?.streaming) return;

        const sig = currentSong?._uniqueId ?? '';
        if (!sig || !currentSong?.id) return;
        if (sig === lastStartedRef.current) return;

        lastStartedRef.current = sig;
        playingSongRef.current = currentSong;

        sendScrobble.mutate({
            apiClientProps: { serverId: currentSong._serverId || '' },
            query: {
                albumId: currentSong.albumId,
                event: 'start',
                id: currentSong.id,
                position: 0,
                submission: false,
            },
        });
    }, [
        isActive,
        isRadioActive,
        scrobbleEnabled,
        isPrivateMode,
        connectStatus?.streaming,
        currentSong,
        sendScrobble,
    ]);

    // ── Submission (track completed naturally) ────────────────────────────
    useEffect(() => {
        if (!isActive || isRadioActive) return;
        if (!scrobbleEnabled || isPrivateMode) return;
        if (!connectStatus?.ended) return;

        const song = playingSongRef.current;
        if (!song?.id) return;
        if (lastSubmittedRef.current === song._uniqueId) return;
        lastSubmittedRef.current = song._uniqueId;

        // Jellyfin's scrobble endpoint uses 100ns ticks; full duration signals
        // "complete" to jellyfin-plugin-lastfm. Subsonic ignores `position`.
        const position = song._serverType === ServerType.JELLYFIN ? song.duration * 1e7 : undefined;

        sendScrobble.mutate({
            apiClientProps: { serverId: song._serverId || '' },
            query: {
                albumId: song.albumId,
                id: song.id,
                position,
                submission: true,
            },
        });
    }, [
        connectStatus?.ended,
        isActive,
        isRadioActive,
        scrobbleEnabled,
        isPrivateMode,
        sendScrobble,
    ]);
};
