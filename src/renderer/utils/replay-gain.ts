import { GainInfo } from '/@/shared/types/domain-types';

export interface ReplayGainSettings {
    replayGainClip: boolean;
    replayGainFallbackDB?: number;
    replayGainMode: 'album' | 'no' | 'track';
    replayGainPreampDB?: number;
}

/**
 * Returns the linear amplitude multiplier to apply for `song` given the
 * user's ReplayGain settings — 1 means "no change". Shared between the web
 * player's Web Audio gain node and the Connect playback gain sent to the
 * backend (where it's used as ffmpeg's `volume` filter, which also expects a
 * linear multiplier).
 */
export const calculateReplayGain = (
    song: { gain: GainInfo | null; peak: GainInfo | null },
    settings: ReplayGainSettings,
): number => {
    if (settings.replayGainMode === 'no') {
        return 1;
    }

    let gain: number | undefined;
    let peak: number | undefined;

    if (settings.replayGainMode === 'track') {
        gain = song.gain?.track ?? song.gain?.album;
        peak = song.peak?.track ?? song.peak?.album;
    } else {
        gain = song.gain?.album ?? song.gain?.track;
        peak = song.peak?.album ?? song.peak?.track;
    }

    if (gain === undefined) {
        gain = settings.replayGainFallbackDB;

        if (!gain) {
            return 1;
        }
    }

    if (peak === undefined) {
        peak = 1;
    }

    const preAmp = settings.replayGainPreampDB ?? 0;

    // https://wiki.hydrogenaud.io/index.php?title=ReplayGain_1.0_specification&section=19
    // Normalized to max gain
    let expectedGain = 10 ** ((gain + preAmp) / 20);

    // Nothing in the system should allow this. But, in the case that preAmp is a
    // bad value (not a number, for example), a NaN gain will cause the entire system to panic
    if (isNaN(expectedGain)) {
        expectedGain = 1;
    }

    if (settings.replayGainClip) {
        return Math.min(expectedGain, 1 / peak);
    }
    return expectedGain;
};
