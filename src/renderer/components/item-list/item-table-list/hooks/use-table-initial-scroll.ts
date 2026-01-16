import { useEffect, useRef } from 'react';

interface UseTableInitialScrollProps {
    initialTop?: {
        behavior?: 'auto' | 'smooth';
        to: number;
        type: 'index' | 'offset';
    };
    scrollToTableIndex: (index: number, options?: { align?: 'bottom' | 'center' | 'top' }) => void;
    scrollToTableOffset: (offset: number) => void;
    startRowIndex?: number;
}

/**
 * Hook to handle initial scroll position and scrolling to top when startRowIndex changes.
 */
export const useTableInitialScroll = ({
    initialTop,
    scrollToTableIndex,
    scrollToTableOffset,
    startRowIndex,
}: UseTableInitialScrollProps) => {
    const isInitialScrollPositionSet = useRef<boolean>(false);

    useEffect(() => {
        if (!initialTop || isInitialScrollPositionSet.current) return;
        isInitialScrollPositionSet.current = true;

        if (initialTop.type === 'offset') {
            scrollToTableOffset(initialTop.to);
        } else {
            scrollToTableIndex(initialTop.to);
        }
    }, [initialTop, scrollToTableIndex, scrollToTableOffset]);

    // Scroll to top when startRowIndex changes
    useEffect(() => {
        if (startRowIndex !== undefined) {
            scrollToTableOffset(0);
        }
    }, [startRowIndex, scrollToTableOffset]);
};
