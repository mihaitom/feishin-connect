import isElectron from 'is-electron';
import { useEffect } from 'react';

import { usePlayerEvents } from '/@/renderer/features/player/audio-player/hooks/use-player-events';
import { usePlayerStore } from '/@/renderer/store';

const ipc = isElectron() ? window.api.ipc : null;
const utils = isElectron() ? window.api.utils : null;
const mpris = isElectron() && utils?.isLinux() ? window.api.mpris : null;

export const useMPRIS = () => {
    const player = usePlayerStore();

    useEffect(() => {
        if (!mpris) {
            return;
        }

        mpris?.requestToggleRepeat(() => {
            player.toggleRepeat();
        });

        mpris?.requestToggleShuffle(() => {
            player.toggleShuffle();
        });

        return () => {
            ipc?.removeAllListeners('mpris-request-toggle-repeat');
            ipc?.removeAllListeners('mpris-request-toggle-shuffle');
        };
    }, [player]);

    usePlayerEvents(
        {
            onPlayerProgress: (properties) => {
                if (!mpris) {
                    return;
                }

                const timestamp = properties.timestamp;
                mpris?.updatePosition(timestamp);
            },
            onPlayerRepeat: () => {
                if (!mpris) {
                    return;
                }

                mpris?.toggleRepeat();
            },
            onPlayerSeek: (properties) => {
                if (!mpris) {
                    return;
                }

                const seconds = properties.seconds;
                mpris?.updateSeek(seconds);
            },
            onPlayerShuffle: () => {
                if (!mpris) {
                    return;
                }

                mpris?.toggleShuffle();
            },
        },
        [],
    );
};
