import clsx from 'clsx';
import { MouseEvent } from 'react';

import styles from './playerbar.module.css';

import { AudioPlayer } from '/@/renderer/features/player/audio-player';
import { CenterControls } from '/@/renderer/features/player/components/center-controls';
import { LeftControls } from '/@/renderer/features/player/components/left-controls';
import { RightControls } from '/@/renderer/features/player/components/right-controls';
import { usePowerSaveBlocker } from '/@/renderer/features/player/hooks/use-power-save-blocker';
import { PlayersRef } from '/@/renderer/features/player/ref/players-ref';
import {
    useFullScreenPlayerStore,
    usePlayerData,
    // usePlayer1Data,
    // usePlayer2Data,
    // usePlayerControls,
    usePlayerMuted,
    usePlayerNum,
    usePlayerStatus,
    usePlayerVolume,
    useSetFullScreenPlayerStore,
} from '/@/renderer/store';
import {
    useGeneralSettings,
    usePlaybackType,
    useSettingsStore,
} from '/@/renderer/store/settings.store';
import { PlaybackSelectors } from '/@/shared/constants/playback-selectors';
import { PlayerType } from '/@/shared/types/types';

export const Playerbar = () => {
    const playersRef = PlayersRef;
    const settings = useSettingsStore((state) => state.playback);
    const { playerbarOpenDrawer } = useGeneralSettings();
    const playbackType = usePlaybackType();
    const volume = usePlayerVolume();
    // const player1 = usePlayer1Data();
    // const player2 = usePlayer2Data();
    const status = usePlayerStatus();
    const player = usePlayerNum();
    const muted = usePlayerMuted();
    // const { autoNext } = usePlayerControls();
    const { expanded: isFullScreenPlayerExpanded } = useFullScreenPlayerStore();
    const setFullScreenPlayerStore = useSetFullScreenPlayerStore();

    usePowerSaveBlocker();

    const handleToggleFullScreenPlayer = (e?: KeyboardEvent | MouseEvent<HTMLDivElement>) => {
        e?.stopPropagation();
        setFullScreenPlayerStore({ expanded: !isFullScreenPlayerExpanded });
    };

    const { player1, player2 } = usePlayerData();

    // const autoNextFn = useCallback(() => {
    //     const playerData = autoNext();
    //     updateSong(playerData.current.song);
    // }, [autoNext]);

    return (
        <div
            className={clsx(styles.container, PlaybackSelectors.mediaPlayer)}
            onClick={playerbarOpenDrawer ? handleToggleFullScreenPlayer : undefined}
        >
            <div className={styles.controlsGrid}>
                <div className={styles.leftGridItem}>
                    <LeftControls />
                </div>
                <div className={styles.centerGridItem}>
                    <CenterControls playersRef={playersRef} />
                </div>
                <div className={styles.rightGridItem}>
                    <RightControls />
                </div>
            </div>
            {playbackType === PlayerType.WEB && (
                <AudioPlayer
                    // autoNext={autoNextFn}
                    crossfadeDuration={settings.crossfadeDuration}
                    crossfadeStyle={settings.crossfadeStyle}
                    currentPlayer={player}
                    muted={muted}
                    playbackStyle={settings.style}
                    player1={player1}
                    player2={player2}
                    ref={playersRef}
                    status={status}
                    style={settings.style as any}
                    volume={(volume / 100) ** 2}
                />
            )}
        </div>
    );
};
