import { useCallback, useMemo } from 'react';

import { TableItemProps } from '../item-table-list';

import { ItemListStateActions } from '/@/renderer/components/item-list/helpers/item-list-state';
import { ItemControls } from '/@/renderer/components/item-list/types';
import { PlayerContext } from '/@/renderer/features/player/context/player-context';
import { LibraryItem } from '/@/shared/types/domain-types';

export const useTableScrollToIndex = ({
    cellPadding,
    columns,
    data,
    enableAlternateRowColors,
    enableExpansion,
    enableHeader,
    enableHorizontalBorders,
    enableRowHoverHighlight,
    enableSelection,
    enableVerticalBorders,
    itemType,
    pinnedLeftColumnRef,
    pinnedRightColumnRef,
    playerContext,
    rowHeight,
    rowRef,
    size,
    tableId,
}: {
    cellPadding: 'lg' | 'md' | 'sm' | 'xl' | 'xs';
    columns: TableItemProps['columns'];
    data: unknown[];
    enableAlternateRowColors: boolean;
    enableExpansion: boolean;
    enableHeader: boolean;
    enableHorizontalBorders: boolean;
    enableRowHoverHighlight: boolean;
    enableSelection: boolean;
    enableVerticalBorders: boolean;
    itemType: LibraryItem;
    pinnedLeftColumnRef: React.RefObject<HTMLDivElement | null>;
    pinnedRightColumnRef: React.RefObject<HTMLDivElement | null>;
    playerContext: PlayerContext;
    rowHeight: ((index: number, cellProps: TableItemProps) => number) | number | undefined;
    rowRef: React.RefObject<HTMLDivElement | null>;
    size: 'compact' | 'default' | 'large';
    tableId: string;
}) => {
    const DEFAULT_ROW_HEIGHT = useMemo(() => {
        return size === 'compact' ? 40 : size === 'large' ? 88 : 64;
    }, [size]);

    const mockCellPropsBase = useMemo<TableItemProps>(
        () => ({
            cellPadding,
            columns,
            controls: {} as ItemControls,
            data: enableHeader ? [null, ...data] : data,
            enableAlternateRowColors,
            enableExpansion,
            enableHeader,
            enableHorizontalBorders,
            enableRowHoverHighlight,
            enableSelection,
            enableVerticalBorders,
            getRowHeight: () => DEFAULT_ROW_HEIGHT,
            internalState: {} as ItemListStateActions,
            itemType,
            playerContext,
            size,
            tableId,
        }),
        [
            DEFAULT_ROW_HEIGHT,
            cellPadding,
            columns,
            data,
            enableAlternateRowColors,
            enableExpansion,
            enableHeader,
            enableHorizontalBorders,
            enableRowHoverHighlight,
            enableSelection,
            enableVerticalBorders,
            itemType,
            playerContext,
            size,
            tableId,
        ],
    );

    const getRowHeightAtIndex = useCallback(
        (index: number) => {
            if (typeof rowHeight === 'number') return rowHeight;
            if (typeof rowHeight === 'function') return rowHeight(index, mockCellPropsBase);
            return DEFAULT_ROW_HEIGHT;
        },
        [DEFAULT_ROW_HEIGHT, mockCellPropsBase, rowHeight],
    );

    const scrollToTableOffset = useCallback(
        (offset: number) => {
            const mainContainer = rowRef.current?.childNodes[0] as HTMLDivElement | undefined;
            const pinnedLeftContainer = pinnedLeftColumnRef.current?.childNodes[0] as
                | HTMLDivElement
                | undefined;
            const pinnedRightContainer = pinnedRightColumnRef.current?.childNodes[0] as
                | HTMLDivElement
                | undefined;

            const behavior = 'instant';

            if (mainContainer) {
                mainContainer.scrollTo({ behavior, top: offset });
            }
            if (pinnedLeftContainer) {
                pinnedLeftContainer.scrollTo({ behavior, top: offset });
            }
            if (pinnedRightContainer) {
                pinnedRightContainer.scrollTo({ behavior, top: offset });
            }
        },
        [pinnedLeftColumnRef, pinnedRightColumnRef, rowRef],
    );

    const calculateScrollTopForIndex = useCallback(
        (index: number) => {
            const adjustedIndex = enableHeader ? Math.max(0, index - 1) : index;
            let scrollTop = 0;

            for (let i = 0; i < adjustedIndex; i++) {
                scrollTop += getRowHeightAtIndex(i);
            }
            return scrollTop;
        },
        [enableHeader, getRowHeightAtIndex],
    );

    const scrollToTableIndex = useCallback(
        (index: number, options?: { align?: 'bottom' | 'center' | 'top' }) => {
            const mainContainer = rowRef.current?.childNodes[0] as HTMLDivElement | undefined;
            if (!mainContainer) return;

            const viewportHeight = mainContainer.clientHeight;
            const align = options?.align || 'top';

            // Calculate the base scroll offset (top of the row)
            let offset = calculateScrollTopForIndex(index);

            // Calculate row height for the target index
            const adjustedIndex = enableHeader ? Math.max(0, index - 1) : index;
            const targetRowHeight = getRowHeightAtIndex(adjustedIndex);

            if (align === 'center') {
                offset = offset - viewportHeight / 2 + targetRowHeight / 2;
            } else if (align === 'bottom') {
                offset = offset - viewportHeight + targetRowHeight;
            }

            offset = Math.max(0, offset);
            scrollToTableOffset(offset);
        },
        [
            calculateScrollTopForIndex,
            enableHeader,
            getRowHeightAtIndex,
            rowRef,
            scrollToTableOffset,
        ],
    );

    return useMemo(
        () => ({
            calculateScrollTopForIndex,
            DEFAULT_ROW_HEIGHT,
            scrollToTableIndex,
            scrollToTableOffset,
        }),
        [calculateScrollTopForIndex, DEFAULT_ROW_HEIGHT, scrollToTableIndex, scrollToTableOffset],
    );
};
