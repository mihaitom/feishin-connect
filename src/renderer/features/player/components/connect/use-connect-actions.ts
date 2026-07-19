import { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { ConnectDevice, connectFetch, SendStatus } from './types';
import { useConnectSend } from './use-connect-send';

import { QueueSong } from '/@/shared/types/domain-types';

interface UseConnectActionsArgs {
    currentSong: QueueSong | undefined;
    currentTrackId: null | string;
    ensureConfigured: () => Promise<void>;
    isActive: boolean;
    isRadioActive: boolean;
    lastAutoSentRef: MutableRefObject<string>;
    mediaPause: () => void;
    pauseRadio: () => void;
    radioStationName: null | string | undefined;
    radioStreamUrl: null | string | undefined;
    refresh: (fresh?: boolean) => void;
    selectedForSend: ConnectDevice[];
    setActive: Dispatch<SetStateAction<ConnectDevice | null>>;
    setActiveTargets: Dispatch<SetStateAction<ConnectDevice[]>>;
    setSelectedForSend: Dispatch<SetStateAction<ConnectDevice[]>>;
    setStatus: Dispatch<SetStateAction<SendStatus>>;
}

/**
 * Connecting a device (or several), adding another device mid-stream, and
 * taking over a device already claimed by someone else — composed from
 * useConnectSend()'s sendTo()/claimOnly() primitives. Disconnecting lives in
 * use-connect-disconnect.ts, the local play/pause/stop pass-through in
 * use-connect-controls.ts.
 */
export const useConnectActions = ({
    currentSong,
    currentTrackId,
    ensureConfigured,
    isActive,
    isRadioActive,
    lastAutoSentRef,
    mediaPause,
    pauseRadio,
    radioStationName,
    radioStreamUrl,
    refresh,
    selectedForSend,
    setActive,
    setActiveTargets,
    setSelectedForSend,
    setStatus,
}: UseConnectActionsArgs) => {
    const { claimOnly, sendTo } = useConnectSend({
        currentSong,
        currentTrackId,
        ensureConfigured,
        isRadioActive,
        lastAutoSentRef,
        mediaPause,
        pauseRadio,
        radioStationName,
        radioStreamUrl,
        setActive,
        setActiveTargets,
        setSelectedForSend,
        setStatus,
    });

    const sendToSelected = async () => {
        // Same "nothing loaded yet" case takeoverDevice() already handles —
        // connecting with an empty queue must still claim the device instead
        // of failing silently (sendTo() itself refuses with no visible error).
        const hasContent = (isRadioActive && !!radioStreamUrl) || !!currentTrackId;
        if (hasContent) {
            await sendTo(selectedForSend, false);
        } else {
            await claimOnly(selectedForSend, false);
        }
    };

    const joinTo = async (devicesToJoin: ConnectDevice[], force: boolean) => {
        for (const device of devicesToJoin) {
            await connectFetch(`/join`, {
                body: JSON.stringify({
                    force,
                    target_name: device.name,
                    target_type: device.type,
                }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            }).catch(() => {});
        }
        setActiveTargets((prev) => {
            const existing = new Set(prev.map((d) => `${d.type}:${d.name}`));
            const added = devicesToJoin.filter((d) => !existing.has(`${d.type}:${d.name}`));
            return [...prev, ...added];
        });
        setSelectedForSend((prev) =>
            prev.filter((d) => !devicesToJoin.some((j) => j.type === d.type && j.name === d.name)),
        );
    };

    const addToStream = async () => {
        if (selectedForSend.length === 0) return;
        await joinTo(selectedForSend, false);
    };

    // Confirmed via the takeover dialog in DeviceItem — re-sends as a single
    // device, either joining the active stream or starting a new one, with
    // force=true so the backend displaces whoever currently owns it. Falls
    // back to claimOnly() when there's nothing loaded to actually play yet,
    // rather than failing outright — see useConnectSend's claimOnly() comment.
    const takeoverDevice = async (device: ConnectDevice) => {
        if (isActive) {
            await joinTo([device], true);
            // Claim ownership just changed hands — re-fetch so this device's
            // "in use by" annotation reflects the new owner (us) instead of
            // the displaced session, without a full re-scan.
            refresh();
            return;
        }
        const hasContent = (isRadioActive && !!radioStreamUrl) || !!currentTrackId;
        const { error } = hasContent
            ? await sendTo([device], true)
            : await claimOnly([device], true);
        // Reported via return value, not a throw — surface it so the takeover
        // dialog's existing catch/toast in device-item.tsx fires instead of
        // silently closing as if the takeover had worked.
        if (error) throw new Error(error);
        refresh();
    };

    const toggleSelectForSend = (device: ConnectDevice) => {
        const key = `${device.type}:${device.name}`;
        setSelectedForSend((prev) => {
            const exists = prev.some((d) => `${d.type}:${d.name}` === key);
            return exists ? prev.filter((d) => `${d.type}:${d.name}` !== key) : [...prev, device];
        });
    };

    return { addToStream, sendToSelected, takeoverDevice, toggleSelectForSend };
};
