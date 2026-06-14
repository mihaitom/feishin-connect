import type { QueueSong } from '/@/shared/types/domain-types';

import { MutableRefObject, useEffect, useRef } from 'react';

import { ConnectDevice, connectFetch, ConnectStatus } from './types';

import { useMpvSettings } from '/@/renderer/store';
import { calculateReplayGain } from '/@/renderer/utils/replay-gain';

interface ConnectPlaybackArgs {
    activeTargets: ConnectDevice[];
    connectStatus: ConnectStatus | null;
    currentSong: QueueSong | undefined;
    isActive: boolean;
    isRadioActive: boolean;
    lastAutoSentRef: MutableRefObject<string>;
    mediaNext: () => void;
    mediaPause: () => void;
    pauseRadio: () => void;
    radioStationName: null | string | undefined;
    radioStreamUrl: null | string | undefined;
}

/**
 * Wires up the three playback effects:
 *   1. Auto-forward on track change (shuffle-aware via usePlayerSong)
 *   2. Auto-forward on radio switch
 *   3. Track-ended detection — level-triggered via backend `ended` flag so it
 *      survives SSE reconnects and page reloads without missing the signal.
 */
export const useConnectPlayback = ({
    activeTargets,
    connectStatus,
    currentSong,
    isActive,
    isRadioActive,
    lastAutoSentRef,
    mediaNext,
    mediaPause,
    pauseRadio,
    radioStationName,
    radioStreamUrl,
}: ConnectPlaybackArgs): void => {
    const advancingRef = useRef(false);
    const replayGainSettings = useMpvSettings();

    // ── Auto-forward: track change ────────────────────────────────────────────
    useEffect(() => {
        if (!isActive || isRadioActive) return;
        const sig = currentSong?._uniqueId ?? '';
        if (!sig || sig === lastAutoSentRef.current) return;
        lastAutoSentRef.current = sig;
        const trackId = currentSong?.id;
        if (!trackId) return;
        mediaPause();
        connectFetch(`/play`, {
            body: JSON.stringify({
                gain: currentSong ? calculateReplayGain(currentSong, replayGainSettings) : 1,
                targets: activeTargets.map((t) => ({ name: t.name, type: t.type })),
                track_ids: [trackId],
            }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        }).catch(() => {});
    }, [
        isActive,
        isRadioActive,
        currentSong,
        activeTargets,
        mediaPause,
        lastAutoSentRef,
        replayGainSettings,
    ]);

    // ── Auto-forward: radio switch ────────────────────────────────────────────
    useEffect(() => {
        if (!isActive || !isRadioActive || !radioStreamUrl) return;
        // Pause (don't stop) the local radio — stopping would clear
        // currentStreamUrl, flip isRadioActive back to false, and make the
        // playerbar/lyrics fall back to showing the previous track. Pausing keeps
        // the radio station "active" so the UI keeps showing it while the Connect
        // target streams the URL directly.
        pauseRadio();
        lastAutoSentRef.current = currentSong?._uniqueId ?? 'radio';
        connectFetch(`/play-url`, {
            body: JSON.stringify({
                targets: activeTargets.map((t) => ({ name: t.name, type: t.type })),
                title: radioStationName ?? 'Radio',
                url: radioStreamUrl,
            }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        }).catch(() => {});
    }, [
        isActive,
        isRadioActive,
        radioStreamUrl,
        radioStationName,
        activeTargets,
        pauseRadio,
        lastAutoSentRef,
        currentSong,
    ]);

    // ── Track-ended detection ─────────────────────────────────────────────────
    // Level-triggered on backend `ended` flag — survives SSE reconnects and
    // page reloads. advancingRef prevents double-advance while /play is in flight.
    useEffect(() => {
        if (!connectStatus || !isActive || connectStatus.radio) return;
        if (connectStatus.streaming) {
            advancingRef.current = false;
            return;
        }
        if (connectStatus.ended && !advancingRef.current) {
            advancingRef.current = true;
            lastAutoSentRef.current = '';
            mediaNext();
            // Feishin calls audioElement.play() synchronously in mediaNext — pause
            // immediately after in the same task so pause() wins before audio is heard.
            mediaPause();
        }
    }, [
        connectStatus?.streaming,
        connectStatus?.ended,
        isActive,
        connectStatus?.radio,
        mediaNext,
        mediaPause,
        lastAutoSentRef,
    ]);
};
