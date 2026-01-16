import { useCallback } from 'react';

import {
    ItemListStateActions,
    ItemListStateItemWithRequiredProperties,
} from '/@/renderer/components/item-list/helpers/item-list-state';
import { TableItemProps } from '/@/renderer/components/item-list/item-table-list/item-table-list';
import { ItemControls } from '/@/renderer/components/item-list/types';
import { PlayerContext } from '/@/renderer/features/player/context/player-context';
import { LibraryItem } from '/@/shared/types/domain-types';

interface UseTableKeyboardNavigationProps {
    calculateScrollTopForIndex: (index: number) => number;
    cellPadding: TableItemProps['cellPadding'];
    data: unknown[];
    DEFAULT_ROW_HEIGHT: number;
    enableHeader: boolean;
    enableSelection: boolean;
    extractRowId: (item: unknown) => string | undefined;
    getStateItem: (item: any) => ItemListStateItemWithRequiredProperties | null;
    hasRequiredStateItemProperties: (
        item: unknown,
    ) => item is ItemListStateItemWithRequiredProperties;
    internalState: ItemListStateActions;
    itemType: LibraryItem;
    parsedColumns: TableItemProps['columns'];
    pinnedRightColumnCount: number;
    pinnedRightColumnRef: React.RefObject<HTMLDivElement | null>;
    playerContext: PlayerContext;
    rowHeight: ((index: number, cellProps: TableItemProps) => number) | number | undefined;
    rowRef: React.RefObject<HTMLDivElement | null>;
    scrollToTableIndex: (index: number, options?: { align?: 'bottom' | 'center' | 'top' }) => void;
    size: TableItemProps['size'];
    tableId: string;
}

/**
 * Hook to handle keyboard navigation (ArrowUp/ArrowDown) for table row selection and scrolling.
 */
export const useTableKeyboardNavigation = ({
    calculateScrollTopForIndex,
    cellPadding,
    data,
    DEFAULT_ROW_HEIGHT,
    enableHeader,
    enableSelection,
    extractRowId,
    getStateItem,
    hasRequiredStateItemProperties,
    internalState,
    itemType,
    parsedColumns,
    pinnedRightColumnCount,
    pinnedRightColumnRef,
    playerContext,
    rowHeight,
    rowRef,
    scrollToTableIndex,
    size,
    tableId,
}: UseTableKeyboardNavigationProps) => {
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (!enableSelection) return;
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            e.stopPropagation();

            const selected = internalState.getSelected();
            const validSelected = selected.filter(hasRequiredStateItemProperties);
            let currentIndex = -1;

            if (validSelected.length > 0) {
                const lastSelected = validSelected[validSelected.length - 1];
                currentIndex = data.findIndex(
                    (d) => extractRowId(d) === extractRowId(lastSelected),
                );
            }

            let newIndex = 0;
            if (currentIndex !== -1) {
                newIndex =
                    e.key === 'ArrowDown'
                        ? Math.min(currentIndex + 1, data.length - 1)
                        : Math.max(currentIndex - 1, 0);
            }

            const newItem: any = data[newIndex];
            if (!newItem) return;

            const newItemListItem = getStateItem(newItem);
            if (newItemListItem && extractRowId(newItemListItem)) {
                internalState.setSelected([newItemListItem]);
            }

            // Check if we need to scroll by determining if the item is at the edge of the viewport
            const gridIndex = enableHeader ? newIndex + 1 : newIndex;

            const mainContainer = rowRef.current?.childNodes[0] as HTMLDivElement | undefined;
            const pinnedRightContainer = pinnedRightColumnRef.current?.childNodes[0] as
                | HTMLDivElement
                | undefined;

            // Use right pinned column scroll position if right-pinned columns exist
            const scrollContainer =
                pinnedRightColumnCount > 0 && pinnedRightContainer
                    ? pinnedRightContainer
                    : mainContainer;

            if (scrollContainer) {
                const viewportTop = scrollContainer.scrollTop;
                const viewportHeight = scrollContainer.clientHeight;
                const viewportBottom = viewportTop + viewportHeight;

                const rowTop = calculateScrollTopForIndex(gridIndex);
                const adjustedIndex = enableHeader ? Math.max(0, newIndex - 1) : newIndex;
                const mockCellProps: TableItemProps = {
                    cellPadding,
                    columns: parsedColumns,
                    controls: {} as ItemControls,
                    data: enableHeader ? [null, ...data] : data,
                    enableAlternateRowColors: false,
                    enableExpansion: false,
                    enableHeader,
                    enableHorizontalBorders: false,
                    enableRowHoverHighlight: false,
                    enableSelection,
                    enableVerticalBorders: false,
                    getRowHeight: () => DEFAULT_ROW_HEIGHT,
                    internalState: {} as ItemListStateActions,
                    itemType,
                    playerContext,
                    size,
                    tableId,
                };

                let calculatedRowHeight: number;
                if (typeof rowHeight === 'number') {
                    calculatedRowHeight = rowHeight;
                } else if (typeof rowHeight === 'function') {
                    calculatedRowHeight = rowHeight(adjustedIndex, mockCellProps);
                } else {
                    calculatedRowHeight = DEFAULT_ROW_HEIGHT;
                }

                const rowBottom = rowTop + calculatedRowHeight;

                // Check if row is fully visible within viewport
                const isFullyVisible = rowTop >= viewportTop && rowBottom <= viewportBottom;

                // Check if row is at the edge (top or bottom of viewport)
                const isAtTopEdge = rowTop < viewportTop;
                const isAtBottomEdge = rowBottom >= viewportBottom;

                // Only scroll if the item is not fully visible or at the edge
                if (!isFullyVisible || isAtTopEdge || isAtBottomEdge) {
                    // Determine alignment based on direction
                    const align: 'bottom' | 'top' =
                        e.key === 'ArrowDown' && isAtBottomEdge
                            ? 'bottom'
                            : e.key === 'ArrowUp' && isAtTopEdge
                              ? 'top'
                              : isAtBottomEdge
                                ? 'bottom'
                                : isAtTopEdge
                                  ? 'top'
                                  : 'top';

                    scrollToTableIndex(gridIndex, { align });
                }
            }
        },
        [
            calculateScrollTopForIndex,
            cellPadding,
            data,
            DEFAULT_ROW_HEIGHT,
            enableHeader,
            enableSelection,
            extractRowId,
            getStateItem,
            hasRequiredStateItemProperties,
            internalState,
            itemType,
            parsedColumns,
            pinnedRightColumnCount,
            pinnedRightColumnRef,
            playerContext,
            rowHeight,
            rowRef,
            scrollToTableIndex,
            size,
            tableId,
        ],
    );

    return { handleKeyDown };
};
