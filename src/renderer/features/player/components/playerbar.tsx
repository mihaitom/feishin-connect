import clsx from 'clsx';
import { lazy, MouseEvent, Suspense } from 'react';

import styles from './playerbar.module.css';
import { ConnectSessionContext } from './connect/connect-session-context';
import { useConnectSession } from './connect/use-connect-session';

import { CenterControls } from '/@/renderer/features/player/components/center-controls';
import { LeftControls } from '/@/renderer/features/player/components/left-controls';
import { RightControls } from '/@/renderer/features/player/components/right-controls';
import { useIsMobile } from '/@/renderer/hooks/use-is-mobile';
import { Spinner } from '/@/shared/components/spinner/spinner';

const MobilePlayerbar = lazy(() =>
    import('./mobile-playerbar').then((module) => ({
        default: module.MobilePlayerbar,
    })),
);
import { useFullScreenPlayerStore, useSetFullScreenPlayerStore } from '/@/renderer/store';
import { usePlayerbarOpenDrawer } from '/@/renderer/store';
import { PlaybackSelectors } from '/@/shared/constants/playback-selectors';

export const Playerbar = () => {
    const playerbarOpenDrawer = usePlayerbarOpenDrawer();
    const { expanded: isFullScreenPlayerExpanded } = useFullScreenPlayerStore();
    const setFullScreenPlayerStore = useSetFullScreenPlayerStore();
    const isMobile = useIsMobile();
    // Session lives here so it survives the mobile/desktop branch switch.
    const session = useConnectSession();

    const handleToggleFullScreenPlayer = (e?: KeyboardEvent | MouseEvent<HTMLDivElement>) => {
        e?.stopPropagation();
        setFullScreenPlayerStore({ expanded: !isFullScreenPlayerExpanded });
    };

    if (isMobile) {
        return (
            <ConnectSessionContext.Provider value={session}>
                <Suspense fallback={<Spinner />}>
                    <MobilePlayerbar />
                </Suspense>
            </ConnectSessionContext.Provider>
        );
    }

    return (
        <ConnectSessionContext.Provider value={session}>
            <div
                className={clsx(styles.container, PlaybackSelectors.mediaPlayer)}
                onClick={playerbarOpenDrawer ? handleToggleFullScreenPlayer : undefined}
            >
                <div className={styles.controlsGrid}>
                    <div className={styles.leftGridItem}>
                        <LeftControls />
                    </div>
                    <div className={styles.centerGridItem}>
                        <CenterControls />
                    </div>
                    <div className={styles.rightGridItem}>
                        <RightControls />
                    </div>
                </div>
            </div>
        </ConnectSessionContext.Provider>
    );
};
