import { useEffect } from 'react';

interface UseStickyHeaderPositioningProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    shouldShowStickyHeader: boolean;
    stickyHeaderRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Hook to update the position and width of the sticky header based on container position.
 * Scroll synchronization is handled separately in useStickyTableHeader.
 */
export const useStickyHeaderPositioning = ({
    containerRef,
    shouldShowStickyHeader,
    stickyHeaderRef,
}: UseStickyHeaderPositioningProps) => {
    useEffect(() => {
        if (!shouldShowStickyHeader || !stickyHeaderRef.current || !containerRef.current) {
            return;
        }

        const stickyHeader = stickyHeaderRef.current;
        const container = containerRef.current;
        let isMounted = true;

        const updatePosition = () => {
            // Guard against updates after unmount
            if (!isMounted || !stickyHeader || !container) {
                return;
            }
            try {
                const containerRect = container.getBoundingClientRect();
                stickyHeader.style.left = `${containerRect.left}px`;
                stickyHeader.style.width = `${containerRect.width}px`;
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
    }, [containerRef, shouldShowStickyHeader, stickyHeaderRef]);
};
