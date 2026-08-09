import isElectron from 'is-electron';
import { useEffect } from 'react';

import { eventEmitter } from '/@/renderer/events/event-emitter';
import { UserFavoriteEventPayload, UserRatingEventPayload } from '/@/renderer/events/events';
import { DiscordRpcHook } from '/@/renderer/features/discord-rpc/use-discord-rpc';
import { MainPlayerListenerHook } from '/@/renderer/features/player/audio-player/hooks/use-main-player-listener';
import { JukeboxPlayer } from '/@/renderer/features/player/audio-player/jukebox-player';
import { MpvPlayer } from '/@/renderer/features/player/audio-player/mpv-player';
import { WebPlayer } from '/@/renderer/features/player/audio-player/web-player';
import { SleepTimerHook } from '/@/renderer/features/player/components/sleep-timer-button';
import { AutoDJHook } from '/@/renderer/features/player/hooks/use-auto-dj';
import { AutosaveHook } from '/@/renderer/features/player/hooks/use-autosave';
import { MediaSessionHook } from '/@/renderer/features/player/hooks/use-media-session';
import { MPRISHook } from '/@/renderer/features/player/hooks/use-mpris';
import { PlaybackHotkeysHook } from '/@/renderer/features/player/hooks/use-playback-hotkeys';
import { PowerSaveBlockerHook } from '/@/renderer/features/player/hooks/use-power-save-blocker';
import {
    InitialTimestampRestoreHook,
    QueueRestoreTimestampHook,
} from '/@/renderer/features/player/hooks/use-queue-restore';
import { ScrobbleHook } from '/@/renderer/features/player/hooks/use-scrobble';
import { UpdateCurrentSongHook } from '/@/renderer/features/player/hooks/use-update-current-song';
import { useWebAudio } from '/@/renderer/features/player/hooks/use-webaudio';
import { RadioWebPlayer } from '/@/renderer/features/radio/components/radio-web-player';
import {
    RadioAudioInstanceHook,
    RadioMetadataHook,
    useIsRadioActive,
} from '/@/renderer/features/radio/hooks/use-radio-player';
import { RemoteHook } from '/@/renderer/features/remote/hooks/use-remote';
import { RemoteConnectHook } from '/@/renderer/features/remote/hooks/use-remote-connect';
import { RemoteLibraryHook } from '/@/renderer/features/remote/hooks/use-remote-library';
import { RemoteQueuePushHook } from '/@/renderer/features/remote/hooks/use-remote-queue-push';
import { RemoteRadioPushHook } from '/@/renderer/features/remote/hooks/use-remote-radio-push';
import { VisualizerSystemAudioBridgeHook } from '/@/renderer/features/visualizer/components/visualizer-system-audio-bridge';
import { useSettingsStore } from '/@/renderer/store';
import {
    updateQueueFavorites,
    updateQueueRatings,
    useCurrentServerId,
    usePlaybackSettings,
    usePlaybackType,
    useSettingsStoreActions,
} from '/@/renderer/store';
import { logFn } from '/@/renderer/utils/logger';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem } from '/@/shared/types/domain-types';
import { PlayerType } from '/@/shared/types/types';
const CODEC_PROBES = [
    { codec: 'mp3', container: 'mp3', mime: 'audio/mpeg' },

    { codec: 'aac', container: 'mp4', mime: 'audio/mp4; codecs="mp4a.40.2"' },
    { codec: 'aac', container: 'aac', mime: 'audio/aac' },
    { codec: 'aac', container: 'mp4', mime: 'audio/x-m4a' },

    { codec: 'opus', container: 'ogg', mime: 'audio/ogg; codecs="opus"' },
    { codec: 'opus', container: 'webm', mime: 'audio/webm; codecs="opus"' },

    { codec: 'vorbis', container: 'ogg', mime: 'audio/ogg; codecs="vorbis"' },
    { codec: 'vorbis', container: 'webm', mime: 'audio/webm; codecs="vorbis"' },

    { codec: 'flac', container: 'flac', mime: 'audio/flac' },

    { codec: ['pcm', 'wav'], container: 'wav', mime: 'audio/wav' },

    { codec: 'alac', container: 'mp4', mime: 'audio/mp4; codecs="alac"' },
];

const DEFAULT_TRANSCODING_PROFILES = [
    { audioCodec: 'flac', container: 'flac', protocol: 'http' },
    { audioCodec: 'opus', container: 'ogg', protocol: 'http' },
    { audioCodec: 'mp3', container: 'mp3', protocol: 'http' },
];

const SAFARI_TRANSCODING_PROFILES = [{ audioCodec: 'mp3', container: 'mp3', protocol: 'http' }];

const DIRECT_PLAY_PROFILES: {
    audioCodecs: string[];
    containers: string[];
    protocols: string[];
}[] = [];

export function getDefaultTranscodingProfiles() {
    return isSafari() ? SAFARI_TRANSCODING_PROFILES : DEFAULT_TRANSCODING_PROFILES;
}

export function getDirectPlayProfiles() {
    return DIRECT_PLAY_PROFILES;
}

// Shamelessly taken from NavidromeUI
function detectBrowserProfile() {
    const audio = new Audio();

    for (const { codec, container, mime } of CODEC_PROBES) {
        if (audio.canPlayType(mime) === 'maybe' || audio.canPlayType(mime) === 'probably') {
            DIRECT_PLAY_PROFILES.push({
                audioCodecs: Array.isArray(codec) ? codec : [codec],
                containers: [container],
                protocols: ['http'],
            });
        }
    }

    logFn.info('DIRECT_PLAY_PROFILES', { meta: DIRECT_PLAY_PROFILES });

    return DIRECT_PLAY_PROFILES;
}

function isSafari() {
    const ua = navigator.userAgent;
    return ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium');
}

export const AudioPlayers = () => {
    const playbackType = usePlaybackType();
    const serverId = useCurrentServerId();
    const { resetSampleRate } = useSettingsStoreActions();

    const {
        audioDeviceId,
        mpvProperties: { audioSampleRateHz },
        webAudio,
    } = usePlaybackSettings();
    const { setWebAudio, webAudio: audioContext } = useWebAudio();

    useEffect(() => {
        detectBrowserProfile();
    }, []);

    return (
        <>
            <SleepTimerHook />
            <ScrobbleHook />
            <PowerSaveBlockerHook />
            <DiscordRpcHook />
            <MPRISHook />
            <MainPlayerListenerHook />
            <MediaSessionHook />
            <PlaybackHotkeysHook />
            <RemoteHook />
            <RemoteConnectHook />
            <RemoteLibraryHook />
            <RemoteQueuePushHook />
            <RemoteRadioPushHook />
            <AutoDJHook />
            <QueueRestoreTimestampHook />
            <InitialTimestampRestoreHook />
            <UpdateCurrentSongHook />
            <RadioAudioInstanceHook />
            <RadioMetadataHook />
            <VisualizerSystemAudioBridgeHook />
            <AutosaveHook />
            <AudioPlayersContent
                audioContext={audioContext}
                audioDeviceId={audioDeviceId}
                audioSampleRateHz={audioSampleRateHz}
                playbackType={playbackType}
                resetSampleRate={resetSampleRate}
                serverId={serverId}
                setWebAudio={setWebAudio}
                webAudio={webAudio}
            />
        </>
    );
};

const AudioPlayersContent = ({
    audioContext,
    audioDeviceId,
    audioSampleRateHz,
    playbackType,
    resetSampleRate,
    serverId,
    setWebAudio,
    webAudio,
}: {
    audioContext: ReturnType<typeof useWebAudio>['webAudio'];
    audioDeviceId: null | string | undefined;
    audioSampleRateHz: number | undefined;
    playbackType: PlayerType;
    resetSampleRate: ReturnType<typeof useSettingsStoreActions>['resetSampleRate'];
    serverId: null | string;
    setWebAudio: ReturnType<typeof useWebAudio>['setWebAudio'];
    webAudio: boolean;
}) => {
    const isRadioActive = useIsRadioActive();

    useEffect(() => {
        if (webAudio && 'AudioContext' in window) {
            let context: AudioContext;

            try {
                context = new AudioContext({
                    latencyHint: 'playback',
                    sampleRate: audioSampleRateHz || undefined,
                });
            } catch (error) {
                // In practice, this should never be hit because the UI should validate
                // the range. However, the actual supported range is not guaranteed
                toast.error({ message: (error as Error).message });
                context = new AudioContext({ latencyHint: 'playback' });
                resetSampleRate();
            }

            const gains = [context.createGain(), context.createGain()];

            // Build DSP chain from persisted settings so EQ/compressor
            // are active immediately on first playback, not just after
            // the user opens the settings panel.
            const { compressor, equalizer } = useSettingsStore.getState().playback;

            // Preamp gain — converts dB to linear
            const preampGain = context.createGain();
            preampGain.gain.value = equalizer.enabled ? Math.pow(10, equalizer.preamp / 20) : 1;

            // One peaking BiquadFilterNode per EQ band
            const eqFilters: BiquadFilterNode[] = equalizer.bands.map((band) => {
                const filter = context.createBiquadFilter();
                filter.type = 'peaking';
                filter.frequency.value = band.freq;
                // Q of 1.41 gives roughly 1-octave bandwidth per band
                filter.Q.value = 1.41;
                filter.gain.value = equalizer.enabled ? band.gain : 0;
                return filter;
            });

            // DynamicsCompressorNode — always present, pass-through when disabled
            // (ratio=1, threshold=0 = mathematically transparent)
            const compressorNode = context.createDynamicsCompressor();
            if (compressor.enabled) {
                compressorNode.threshold.value = compressor.threshold;
                compressorNode.ratio.value = compressor.ratio;
                compressorNode.attack.value = compressor.attack / 1000;
                compressorNode.release.value = compressor.release / 1000;
                compressorNode.knee.value = compressor.knee;
            } else {
                compressorNode.threshold.value = 0;
                compressorNode.ratio.value = 1;
                compressorNode.attack.value = 0;
                compressorNode.release.value = 0.25;
                compressorNode.knee.value = 0;
            }

            // Wire: each gain → preamp → eq[0] → eq[1] → ... → compressor → destination
            for (const gain of gains) {
                gain.connect(preampGain);
            }

            if (eqFilters.length > 0) {
                preampGain.connect(eqFilters[0]);
                for (let i = 0; i < eqFilters.length - 1; i++) {
                    eqFilters[i].connect(eqFilters[i + 1]);
                }
                eqFilters[eqFilters.length - 1].connect(compressorNode);
            } else {
                preampGain.connect(compressorNode);
            }

            compressorNode.connect(context.destination);

            setWebAudio!({
                context,
                dsp: { compressor: compressorNode, eqFilters, preampGain },
                gains,
            });

            // Mobile browsers require AudioContext.resume() to happen
            // synchronously inside a user-gesture handler. The resume()
            // calls in web-player.tsx's handlePlayer1Start/handlePlayer2Start
            // happen too late for that — they're async callbacks fired after
            // react-player's own "started" event, not inside the tap itself
            // — which routinely leaves the context stuck "suspended" on
            // mobile Safari/Chrome: the underlying <audio> element still
            // plays (the browser tab shows its audio-playing icon) but
            // produces no audible output at all, since its stream is routed
            // into this suspended context via createMediaElementSource()
            // instead of straight to the speakers. A one-time listener on
            // the very first tap/click anywhere resumes it while still
            // inside that gesture's activation window. Desktop browsers
            // don't need this (they resume regardless of the async callback
            // timing) but it's a harmless no-op there.
            const unlock = () => {
                context.resume().catch(() => {});
            };
            document.addEventListener('pointerdown', unlock, { once: true });
            document.addEventListener('touchend', unlock, { once: true });
            document.addEventListener('click', unlock, { once: true });
        }

        // Intentionally ignore the sample rate dependency, as it makes things really messy
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // Not standard, just used in chromium-based browsers. See
        // https://developer.chrome.com/blog/audiocontext-setsinkid/.

        if (!isElectron()) {
            return;
        }

        if (playbackType !== PlayerType.WEB) {
            return;
        }

        if (audioContext && 'setSinkId' in audioContext.context && audioDeviceId) {
            const setSink = async () => {
                try {
                    if (audioContext.context.state !== 'closed') {
                        await (audioContext.context as any).setSinkId(audioDeviceId);
                    }
                } catch (error) {
                    toast.error({ message: `Error setting sink: ${(error as Error).message}` });
                }
            };

            setSink();
        }
    }, [audioContext, audioDeviceId, playbackType]);

    // Listen to favorite and rating events to update queue songs
    useEffect(() => {
        const handleFavorite = (payload: UserFavoriteEventPayload) => {
            if (payload.itemType !== LibraryItem.SONG || payload.serverId !== serverId) {
                return;
            }

            updateQueueFavorites(payload.id, payload.favorite);
        };

        const handleRating = (payload: UserRatingEventPayload) => {
            if (payload.itemType !== LibraryItem.SONG || payload.serverId !== serverId) {
                return;
            }

            updateQueueRatings(payload.id, payload.rating);
        };

        eventEmitter.on('USER_FAVORITE', handleFavorite);
        eventEmitter.on('USER_RATING', handleRating);

        return () => {
            eventEmitter.off('USER_FAVORITE', handleFavorite);
            eventEmitter.off('USER_RATING', handleRating);
        };
    }, [serverId]);

    if (isRadioActive && playbackType === PlayerType.LOCAL) {
        return <MpvPlayer />;
    }

    if (isRadioActive && playbackType === PlayerType.WEB) {
        return <RadioWebPlayer />;
    }

    return (
        <>
            {playbackType === PlayerType.WEB && <WebPlayer />}
            {playbackType === PlayerType.LOCAL && <MpvPlayer />}
            {playbackType === PlayerType.JUKEBOX && <JukeboxPlayer />}
        </>
    );
};
