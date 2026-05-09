import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCast, LuSquare, LuTriangleAlert } from 'react-icons/lu';

import { DeviceItem } from './device-item';
import { useConnectDevices, useConnectStatus, useConnectVolume } from './hooks';
import { NowPlayingSection } from './now-playing';
import { CONNECT_URL, ConnectDevice, ConnectStatus, SendStatus } from './types';
import { PopButton, PopSection } from './ui';

import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { useIsRadioActive, useRadioStore } from '/@/renderer/features/radio/hooks/use-radio-player';
import { useCurrentServerWithCredential } from '/@/renderer/store/auth.store';
import { usePlayerStatus, usePlayerStoreBase } from '/@/renderer/store/player.store';
import { PlayerStatus } from '/@/shared/types/types';

export const ConnectButton = () => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<SendStatus>('idle');
    const [activeDevice, setActive] = useState<ConnectDevice | null>(null);
    // Local cache of active targets — updated immediately on actions, not waiting for the 2s poll
    const [activeTargets, setActiveTargets] = useState<ConnectDevice[]>([]);
    const [selectedForSend, setSelectedForSend] = useState<ConnectDevice[]>([]);
    const [popPos, setPopPos] = useState({ bottom: 0, right: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);

    const { devices, health, refresh } = useConnectDevices();
    const { fetchVolume } = useConnectVolume();
    const { mediaNext, mediaPause, mediaPrevious, mediaTogglePlayPause } = usePlayer();
    const stopRadio = useRadioStore((s) => s.actions.stop);

    const playerStatus = usePlayerStatus();
    const feishinPlaying = playerStatus === PlayerStatus.PLAYING;

    const prevConnectIndexRef = useRef(-1);
    // Tracks the last auto-forwarded "index:uid" so queue-tail changes don't re-trigger
    const lastAutoSentRef = useRef<string>('');

    const handleTrackAdvance = useCallback(
        (delta: number) => {
            if (delta > 0) {
                for (let i = 0; i < delta; i++) mediaNext();
            } else {
                for (let i = 0; i < -delta; i++) mediaPrevious();
            }
        },
        [mediaNext, mediaPrevious],
    );

    const isActive = !!activeDevice;
    const connectStatus = useConnectStatus(isActive, open, prevConnectIndexRef, handleTrackAdvance);
    const connectPlaying = isActive && !connectStatus?.paused;

    // Keep local activeTargets in sync with backend truth once polls arrive
    useEffect(() => {
        if (!connectStatus) return;
        if (connectStatus.streaming && connectStatus.targets.length > 0) {
            setActiveTargets(
                connectStatus.targets.map((t) => ({
                    name: t.name,
                    type: t.type as ConnectDevice['type'],
                })),
            );
        } else if (!connectStatus.streaming) {
            setActiveTargets([]);
        }
    }, [connectStatus]);

    const server = useCurrentServerWithCredential();
    const configuredRef = useRef(false);
    useEffect(() => {
        if (!server?.url || !server?.credential) return;
        fetch(`${CONNECT_URL}/config`, {
            body: JSON.stringify({ credential: server.credential, url: server.url }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        })
            .then(() => {
                configuredRef.current = true;
            })
            .catch(() => {});
    }, [server?.url, server?.credential]);

    useEffect(() => {
        fetch(`${CONNECT_URL}/status`)
            .then((r) => r.json())
            .then((d: ConnectStatus) => {
                if (d.streaming && d.targets?.length > 0) {
                    const restored = d.targets.map((t: { name: string; type: string }) => ({
                        name: t.name,
                        type: t.type as ConnectDevice['type'],
                    }));
                    setActiveTargets(restored);
                    setActive(restored[0]);
                    setStatus('success');
                }
            })
            .catch(() => {});
    }, []);

    const queueDefault = usePlayerStoreBase((s) => s.queue.default);
    const queueSongs = usePlayerStoreBase((s) => s.queue.songs);
    const playerIndex = usePlayerStoreBase((s) => s.player.index);
    const isRadioActive = useIsRadioActive();
    const radioStreamUrl = useRadioStore((s) => s.currentStreamUrl);
    const radioStationName = useRadioStore((s) => s.stationName);

    // ── Auto-forward: Track-Wechsel während Connect aktiv ist ─────────────────
    // Wenn der lokale Player startet (PLAYING) und Connect aktiv ist, sofort
    // pausieren und die neue Queue an das Gerät schicken.
    useEffect(() => {
        if (!isActive || isRadioActive) return;
        if (playerStatus !== PlayerStatus.PLAYING) return;

        const uid = queueDefault?.[playerIndex] ?? '';
        const sig = `${playerIndex}:${uid}`;
        if (sig === lastAutoSentRef.current) return; // gleicher Track, nichts tun
        lastAutoSentRef.current = sig;

        mediaPause();

        const ids = (queueDefault ?? [])
            .slice(Math.max(0, playerIndex))
            .map((u) => queueSongs?.[u]?.id)
            .filter((id): id is string => !!id);
        if (ids.length === 0) return;

        prevConnectIndexRef.current = -1;
        fetch(`${CONNECT_URL}/play`, {
            body: JSON.stringify({
                targets: activeTargets.map((t) => ({ name: t.name, type: t.type })),
                track_ids: ids,
            }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        }).catch(() => {});
    }, [isActive, isRadioActive, playerStatus, playerIndex, queueDefault, queueSongs, activeTargets, mediaPause]);

    // ── Auto-forward: Radio-Wechsel während Connect aktiv ist ────────────────
    // Wenn der User auf Radio umschaltet während ein Gerät aktiv ist,
    // Radio lokal stoppen und an das Gerät weiterleiten.
    useEffect(() => {
        if (!isActive || !isRadioActive || !radioStreamUrl) return;

        stopRadio();
        lastAutoSentRef.current = '';
        prevConnectIndexRef.current = -1;
        fetch(`${CONNECT_URL}/play-url`, {
            body: JSON.stringify({
                targets: activeTargets.map((t) => ({ name: t.name, type: t.type })),
                title: radioStationName ?? 'Radio',
                url: radioStreamUrl,
            }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        }).catch(() => {});
    }, [isActive, isRadioActive, radioStreamUrl, radioStationName, activeTargets, stopRadio]);

    const trackIds = (queueDefault ?? [])
        .slice(Math.max(0, playerIndex))
        .map((uid) => queueSongs?.[uid]?.id)
        .filter((id): id is string => !!id);

    const isEmpty = trackIds.length === 0 && !radioStreamUrl;

    const handleOpen = () => {
        // Always allow opening when there's an API/ffmpeg problem so the user sees the error.
        const hasError = !health?.apiReachable || health?.ffmpegFound === false;
        if (isEmpty && !hasError) return;
        if (!open && btnRef.current) {
            if (activeDevice?.type === 'sonos') fetchVolume();
            const rect = btnRef.current.getBoundingClientRect();
            setPopPos({
                bottom: window.innerHeight - rect.top + 40,
                right: window.innerWidth - rect.right - 120,
            });
            refresh();
        }
        setOpen((o) => !o);
    };

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const pop = document.getElementById('connect-popover');
            if (
                pop &&
                !pop.contains(e.target as Node) &&
                btnRef.current &&
                !btnRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // ── Actions ────────────────────────────────────────────────────────────────

    const ensureConfigured = async () => {
        if (!configuredRef.current && server?.url && server?.credential) {
            await fetch(`${CONNECT_URL}/config`, {
                body: JSON.stringify({ credential: server.credential, url: server.url }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            });
            configuredRef.current = true;
        }
    };

    const sendToSelected = async () => {
        if (selectedForSend.length === 0) return;
        const first = selectedForSend[0];
        setActive(first);
        setActiveTargets(selectedForSend);
        setStatus('loading');
        setOpen(false);
        prevConnectIndexRef.current = -1;
        try {
            await ensureConfigured();
            const targets = selectedForSend.map((d) => ({ name: d.name, type: d.type }));

            if (isRadioActive && radioStreamUrl) {
                const res = await fetch(`${CONNECT_URL}/play-url`, {
                    body: JSON.stringify({
                        targets,
                        title: radioStationName ?? 'Radio',
                        url: radioStreamUrl,
                    }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                stopRadio();
            } else {
                const res = await fetch(`${CONNECT_URL}/play`, {
                    body: JSON.stringify({ targets, track_ids: trackIds }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                mediaPause();
            }
            setStatus('success');
            setSelectedForSend([]);
        } catch (e) {
            console.error('[Connect]', e);
            setStatus('error');
            setActive(null);
            setActiveTargets([]);
            setTimeout(() => setStatus('idle'), 2000);
        }
    };

    // Join selected devices to the running stream without restarting
    const addToStream = async () => {
        if (selectedForSend.length === 0) return;
        for (const device of selectedForSend) {
            await fetch(`${CONNECT_URL}/join`, {
                body: JSON.stringify({ target_name: device.name, target_type: device.type }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            }).catch(() => {});
        }
        setActiveTargets((prev) => {
            const existing = new Set(prev.map((d) => `${d.type}:${d.name}`));
            const added = selectedForSend.filter((d) => !existing.has(`${d.type}:${d.name}`));
            return [...prev, ...added];
        });
        setSelectedForSend([]);
    };

    const stopAllPlayback = async () => {
        await fetch(`${CONNECT_URL}/stop`, { method: 'POST' }).catch(() => {});
        setStatus('idle');
        setActive(null);
        setActiveTargets([]);
        setSelectedForSend([]);
        setOpen(false);
        prevConnectIndexRef.current = -1;
        lastAutoSentRef.current = '';
    };

    const stopSingleDevice = async (device: ConnectDevice) => {
        const url =
            `${CONNECT_URL}/device-stop?device_type=${device.type}` +
            `&name=${encodeURIComponent(device.name)}`;
        await fetch(url, { method: 'POST' }).catch(() => {});
        const remaining = activeTargets.filter(
            (tgt) => !(tgt.type === device.type && tgt.name === device.name),
        );
        setActiveTargets(remaining);
        if (remaining.length === 0) {
            setActive(null);
            setStatus('idle');
        } else {
            setActive(remaining[0]);
        }
    };

    const toggleSelectForSend = (device: ConnectDevice) => {
        const key = `${device.type}:${device.name}`;
        setSelectedForSend((prev) => {
            const exists = prev.some((d) => `${d.type}:${d.name}` === key);
            return exists ? prev.filter((d) => `${d.type}:${d.name}` !== key) : [...prev, device];
        });
    };

    const handlePrevious = () => {
        if (isActive && !connectStatus?.radio) {
            fetch(`${CONNECT_URL}/previous`, { method: 'POST' }).catch(() => {});
        } else {
            mediaPrevious();
        }
    };

    const handleNext = () => {
        if (isActive && !connectStatus?.radio) {
            fetch(`${CONNECT_URL}/next`, { method: 'POST' }).catch(() => {});
        } else {
            mediaNext();
        }
    };

    const handleTogglePlayPause = () => {
        if (isActive) {
            const endpoint = connectPlaying ? '/pause' : '/resume';
            fetch(`${CONNECT_URL}${endpoint}`, { method: 'POST' }).catch(() => {});
        } else {
            mediaTogglePlayPause();
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    const hasApiError = health !== null && !health.apiReachable;
    const hasFfmpegError = health?.apiReachable && health.ffmpegFound === false;

    const iconColor =
        status === 'error' || hasApiError || hasFfmpegError
            ? 'var(--theme-colors-warning, #f5a623)'
            : isActive
              ? 'var(--theme-colors-primary)'
              : 'var(--theme-colors-text-secondary)';

    const isRadioMode = isActive && !!connectStatus?.radio;
    const isPlaying = isActive ? connectPlaying : feishinPlaying;
    const nowPlayingTitle =
        connectStatus?.current_track?.title ?? connectStatus?.radio?.title ?? '…';

    const trackLabel = isRadioActive
        ? `Radio · ${radioStationName ?? ''}`
        : t('entity.trackWithCount', { count: trackIds.length });

    return (
        <>
            <button
                disabled={status === 'loading'}
                onClick={handleOpen}
                ref={btnRef}
                style={{
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: iconColor,
                    cursor: isEmpty ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    opacity: isEmpty ? 0.3 : 1,
                    padding: '4px',
                    transition: 'color 0.2s',
                }}
                title={
                    isEmpty
                        ? t('player.connect_emptyQueue', { postProcess: 'sentenceCase' })
                        : isActive
                          ? `▶ ${activeDevice!.name} · ${nowPlayingTitle}`
                          : t('player.connect_playOnDevice', { postProcess: 'sentenceCase' })
                }
            >
                <LuCast size={20} style={{ opacity: isActive ? 1 : 0.7 }} />
            </button>

            {open && (
                <div
                    id="connect-popover"
                    style={{
                        background: 'var(--theme-colors-background, #1a1a2e)',
                        border: '1px solid var(--theme-colors-border)',
                        borderRadius: '8px',
                        bottom: `${popPos.bottom}px`,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                        overflow: 'hidden',
                        position: 'fixed',
                        right: `${popPos.right}px`,
                        width: '300px',
                        zIndex: 9999,
                    }}
                >
                    {/* Now Playing */}
                    {isActive && (
                        <NowPlayingSection
                            connectStatus={connectStatus}
                            isPlaying={isPlaying}
                            isRadioMode={isRadioMode}
                            onNext={handleNext}
                            onPrevious={handlePrevious}
                            onTogglePlayPause={handleTogglePlayPause}
                        />
                    )}

                    {/* Error banners */}
                    {hasApiError && (
                        <div
                            style={{
                                alignItems: 'flex-start',
                                background: 'rgba(245,166,35,0.1)',
                                borderBottom: '1px solid rgba(245,166,35,0.2)',
                                display: 'flex',
                                gap: '8px',
                                padding: '10px 12px',
                            }}
                        >
                            <LuTriangleAlert
                                size={15}
                                style={{ color: '#f5a623', flexShrink: 0, marginTop: '2px' }}
                            />
                            <div>
                                <div
                                    style={{
                                        color: '#f5a623',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                    }}
                                >
                                    {t('player.connect_apiUnreachable', {
                                        postProcess: 'sentenceCase',
                                    })}
                                </div>
                                <div
                                    style={{
                                        color: 'var(--theme-colors-text-secondary)',
                                        fontSize: '11px',
                                        marginTop: '2px',
                                        wordBreak: 'break-all',
                                    }}
                                >
                                    {t('player.connect_apiUnreachableHint', { url: CONNECT_URL })}
                                </div>
                                <button
                                    onClick={refresh}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#f5a623',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        marginTop: '4px',
                                        padding: 0,
                                    }}
                                >
                                    {t('player.connect_scan', { postProcess: 'sentenceCase' })}
                                </button>
                            </div>
                        </div>
                    )}
                    {hasFfmpegError && (
                        <div
                            style={{
                                alignItems: 'flex-start',
                                background: 'rgba(245,166,35,0.1)',
                                borderBottom: '1px solid rgba(245,166,35,0.2)',
                                display: 'flex',
                                gap: '8px',
                                padding: '10px 12px',
                            }}
                        >
                            <LuTriangleAlert
                                size={15}
                                style={{ color: '#f5a623', flexShrink: 0, marginTop: '2px' }}
                            />
                            <div>
                                <div
                                    style={{
                                        color: '#f5a623',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                    }}
                                >
                                    {t('player.connect_ffmpegMissing', {
                                        postProcess: 'sentenceCase',
                                    })}
                                </div>
                                <div
                                    style={{
                                        color: 'var(--theme-colors-text-secondary)',
                                        fontSize: '11px',
                                        marginTop: '2px',
                                    }}
                                >
                                    {t('player.connect_ffmpegMissingHint', {
                                        postProcess: 'sentenceCase',
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Device list — hidden when API is unreachable */}
                    {!hasApiError && (
                        <PopSection
                            label={`${trackLabel} ${t('player.connect_sendTo', { postProcess: 'sentenceCase' })}`}
                        >
                            {devices.length === 0 && (
                                <div
                                    style={{
                                        color: 'var(--theme-colors-text-secondary)',
                                        fontSize: '13px',
                                        padding: '8px 12px 12px',
                                        textAlign: 'center',
                                    }}
                                >
                                    {t('player.connect_noDevices', { postProcess: 'sentenceCase' })}
                                    <br />
                                    <button
                                        onClick={refresh}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--theme-colors-primary)',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            marginTop: '6px',
                                            padding: 0,
                                        }}
                                    >
                                        {t('player.connect_scan', { postProcess: 'sentenceCase' })}
                                    </button>
                                </div>
                            )}
                            {devices.map((d) => {
                                const key = `${d.type}:${d.name}`;
                                const isDeviceActive = activeTargets.some(
                                    (tgt) => tgt.type === d.type && tgt.name === d.name,
                                );
                                const isDeviceSelected = selectedForSend.some(
                                    (s) => `${s.type}:${s.name}` === key,
                                );
                                return (
                                    <DeviceItem
                                        device={d}
                                        isActive={isDeviceActive}
                                        isSelected={isDeviceSelected}
                                        key={key}
                                        onStop={() => stopSingleDevice(d)}
                                        onToggleSelect={() => toggleSelectForSend(d)}
                                    />
                                );
                            })}
                        </PopSection>
                    )}

                    {/* Send button — appears when inactive devices are selected */}
                    {selectedForSend.length > 0 && (
                        <div style={{ padding: '4px 12px 10px' }}>
                            <button
                                onClick={isActive ? addToStream : sendToSelected}
                                style={{
                                    background: 'var(--theme-colors-primary)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: 'var(--theme-colors-background)',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    padding: '8px 0',
                                    width: '100%',
                                }}
                            >
                                {isActive
                                    ? t('player.connect_add', { count: selectedForSend.length })
                                    : `${trackLabel} → ${t('player.connect_device', { count: selectedForSend.length })}`}
                            </button>
                        </div>
                    )}

                    {/* Stop all */}
                    {isActive && (
                        <>
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
                            <PopButton
                                danger
                                icon={<LuSquare size={14} />}
                                label={t('player.connect_stopAll', { postProcess: 'sentenceCase' })}
                                onClick={stopAllPlayback}
                            />
                        </>
                    )}
                </div>
            )}
        </>
    );
};
