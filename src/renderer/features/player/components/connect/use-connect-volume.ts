import { useCallback, useRef, useState } from 'react';

import { connectFetch } from './types';

export const useConnectVolume = () => {
    const [volume, setVolume] = useState<null | number>(null);
    const [muted, setMuted] = useState(false);
    const preMuteVolume = useRef(30);

    const fetchVolume = useCallback(() => {
        connectFetch(`/volume`)
            .then((r) => r.json())
            .then((d) => {
                if (d.volume !== undefined) setVolume(d.volume);
            })
            .catch(() => {});
    }, []);

    const setRemoteVolume = (v: number) => {
        setVolume(v);
        connectFetch(`/volume`, {
            body: JSON.stringify({ volume: v }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        }).catch(() => {});
    };

    const toggleMute = () => {
        if (muted) {
            setMuted(false);
            setRemoteVolume(preMuteVolume.current);
        } else {
            preMuteVolume.current = volume ?? 30;
            setMuted(true);
            setRemoteVolume(0);
        }
    };

    return { fetchVolume, muted, setRemoteVolume, toggleMute, volume };
};
