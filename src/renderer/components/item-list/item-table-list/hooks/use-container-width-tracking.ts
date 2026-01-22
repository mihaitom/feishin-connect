import { useLayoutEffect } from 'react';

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
    const createWidthUpdater = (
        el: HTMLDivElement,
        setWidth: (width: number) => void,
        opts?: { maxRafRetries?: number },
    ) => {
        const maxRafRetries = opts?.maxRafRetries ?? 10;
        let rafId: null | number = null;

        const cancel = () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            rafId = null;
        };

        const updateWidth = () => {
            const measured = el.clientWidth || 0;
            if (measured > 0) {
                cancel();
                setWidth(measured);
                return;
            }

            // Some layouts can report 0 on first paint
            // Retry a few frames to catch the first non-zero measurement
            cancel();
            let attempts = 0;
            const retry = () => {
                const next = el.clientWidth || 0;
                if (next > 0) {
                    rafId = null;
                    setWidth(next);
                    return;
                }
                attempts++;
                if (attempts < maxRafRetries) {
                    rafId = requestAnimationFrame(retry);
                } else {
                    rafId = null;
                    setWidth(0);
                }
            };
            rafId = requestAnimationFrame(retry);
        };

        return { cancel, updateWidth };
    };

    // Track center container width (for column distribution)
    useLayoutEffect(() => {
        const el = rowRef.current;
        if (!el) return;

        const { cancel, updateWidth } = createWidthUpdater(el, setCenterContainerWidth);

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
            cancel();
            resizeObserver.disconnect();
        };
    }, [rowRef, setCenterContainerWidth]);

    // Track total container width for autoFitColumns
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el || !autoFitColumns) return;

        const { cancel, updateWidth } = createWidthUpdater(el, setTotalContainerWidth);

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
            cancel();
            resizeObserver.disconnect();
        };
    }, [autoFitColumns, containerRef, setTotalContainerWidth]);
};
