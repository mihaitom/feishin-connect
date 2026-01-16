import { useEffect } from 'react';

interface UseStickyGroupRowPositioningProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    shouldRenderStickyGroupRow: boolean;
    stickyGroupRowRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Hook to update the position and width of the sticky group row based on container position.
 */
export const useStickyGroupRowPositioning = ({
    containerRef,
    shouldRenderStickyGroupRow,
    stickyGroupRowRef,
}: UseStickyGroupRowPositioningProps) => {
    useEffect(() => {
        if (!shouldRenderStickyGroupRow || !stickyGroupRowRef.current || !containerRef.current) {
            return;
        }

        const stickyGroupRow = stickyGroupRowRef.current;
        const container = containerRef.current;
        let isMounted = true;

        const updatePosition = () => {
            // Guard against updates after unmount
            if (!isMounted || !stickyGroupRow || !container) {
                return;
            }
            try {
                const containerRect = container.getBoundingClientRect();
                stickyGroupRow.style.left = `${containerRect.left}px`;
                stickyGroupRow.style.width = `${containerRect.width}px`;
            } catch {
                // Silently handle errors if elements are no longer in DOM
            }
        };

        updatePosition();

        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            isMounted = false;
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [containerRef, shouldRenderStickyGroupRow, stickyGroupRowRef]);
};
