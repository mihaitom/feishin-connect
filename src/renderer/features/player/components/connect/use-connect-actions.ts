import { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { connectFetchEnsured } from './connect-request';
import { ConnectDevice, SendStatus } from './types';
import { useConnectSend } from './use-connect-send';

import { QueueSong } from '/@/shared/types/domain-types';

interface UseConnectActionsArgs {
    currentSong: QueueSong | undefined;
    currentTrackId: null | string;
    ensureConfigured: () => Promise<void>;
    forceReconfigure: () => Promise<void>;
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
    forceReconfigure,
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
        forceReconfigure,
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

    // Same "nothing loaded yet" case takeoverDevice() already handles —
    // connecting with an empty queue must still claim the device instead
    // of failing silently (sendTo() itself refuses with no visible error).
    const sendToDevices = async (devices: ConnectDevice[], force: boolean) => {
        const hasContent = (isRadioActive && !!radioStreamUrl) || !!currentTrackId;
        return hasContent ? sendTo(devices, force) : claimOnly(devices, force);
    };

    const sendToSelected = async () => {
        await sendToDevices(selectedForSend, false);
    };

    const joinTo = async (devicesToJoin: ConnectDevice[], force: boolean) => {
        for (const device of devicesToJoin) {
            await connectFetchEnsured(
                `/join`,
                {
                    body: JSON.stringify({
                        force,
                        target_name: device.name,
                        target_type: device.type,
                    }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                },
                ensureConfigured,
                forceReconfigure,
            ).catch(() => {});
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

    // Unified connect action for callers (the phone-remote bridge) that don't
    // distinguish "start a new stream" from "add to the one already playing" —
    // desktop exposes those as separate buttons (sendToSelected/addToStream),
    // but a single imperative call is simpler for a remote client to reason
    // about. Mirrors what those two buttons do under the hood.
    const connectDevices = async (devices: ConnectDevice[], force: boolean) => {
        if (isActive) {
            await joinTo(devices, force);
            return { error: null };
        }
        return sendToDevices(devices, force);
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

    return { addToStream, connectDevices, sendToSelected, takeoverDevice, toggleSelectForSend };
};
