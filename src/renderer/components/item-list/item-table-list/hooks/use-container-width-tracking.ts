import { useEffect } from 'react';

interface UseContainerWidthTrackingProps {
    autoFitColumns: boolean;
    containerRef: React.RefObject<HTMLDivElement | null>;
    rowRef: React.RefObject<HTMLDivElement | null>;
    setCenterContainerWidth: (width: number) => void;
    setTotalContainerWidth: (width: number) => void;
}

/**
 * Hook to track container widths using ResizeObserver for column width calculations.
 */
export const useContainerWidthTracking = ({
    autoFitColumns,
    containerRef,
    rowRef,
    setCenterContainerWidth,
    setTotalContainerWidth,
}: UseContainerWidthTrackingProps) => {
    // Track center container width (for column distribution)
    useEffect(() => {
        const el = rowRef.current;
        if (!el) return;

        const updateWidth = () => {
            setCenterContainerWidth(el.clientWidth || 0);
        };

        updateWidth();

        let debounceTimeout: NodeJS.Timeout | null = null;
        const resizeObserver = new ResizeObserver(() => {
            if (debounceTimeout) {
                clearTimeout(debounceTimeout);
            }
            debounceTimeout = setTimeout(() => {
                updateWidth();
            }, 100);
        });

        resizeObserver.observe(el);

        return () => {
            if (debounceTimeout) {
                clearTimeout(debounceTimeout);
            }
            resizeObserver.disconnect();
        };
    }, [rowRef, setCenterContainerWidth]);

    // Track total container width for autoFitColumns
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !autoFitColumns) return;

        const updateWidth = () => {
            setTotalContainerWidth(el.clientWidth || 0);
        };

        updateWidth();

        let debounceTimeout: NodeJS.Timeout | null = null;
        const resizeObserver = new ResizeObserver(() => {
            if (debounceTimeout) {
                clearTimeout(debounceTimeout);
            }
            debounceTimeout = setTimeout(() => {
                updateWidth();
            }, 100);
        });

        resizeObserver.observe(el);

        return () => {
            if (debounceTimeout) {
                clearTimeout(debounceTimeout);
            }
            resizeObserver.disconnect();
        };
    }, [autoFitColumns, containerRef, setTotalContainerWidth]);
};
