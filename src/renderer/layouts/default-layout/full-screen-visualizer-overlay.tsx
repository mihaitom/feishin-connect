import { AnimatePresence } from 'motion/react';

import { FullScreenVisualizer } from '/@/renderer/features/player/components/full-screen-visualizer';
import { useFullScreenPlayerStore } from '/@/renderer/store/full-screen-player.store';

export const FullScreenVisualizerOverlay = () => {
    const { visualizerExpanded: isFullScreenVisualizerExpanded } = useFullScreenPlayerStore();

    return (
        <AnimatePresence initial={false}>
            {isFullScreenVisualizerExpanded && <FullScreenVisualizer />}
        </AnimatePresence>
    );
};
