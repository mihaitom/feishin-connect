import { useMemo } from 'react';

import { TableGroupHeader } from '/@/renderer/components/item-list/item-table-list/item-table-list';

export const useTableRowModel = ({
    data,
    enableHeader,
    groups,
}: {
    data: unknown[];
    enableHeader: boolean;
    groups?: TableGroupHeader[];
}) => {
    const dataWithGroups = useMemo(() => {
        const result: (null | unknown)[] = enableHeader ? [null] : [];

        if (!groups || groups.length === 0) {
            result.push(...data);
            return result;
        }

        // Build the expanded row model: [header?] + (groupHeader + groupItems)* + any remaining items.
        let dataIndex = 0;
        for (const group of groups) {
            // Group header row
            result.push(null);

            // Group items
            const end = Math.min(data.length, dataIndex + group.itemCount);
            for (; dataIndex < end; dataIndex++) {
                result.push(data[dataIndex]);
            }
        }

        // If groups don't account for all items, append the remainder.
        for (; dataIndex < data.length; dataIndex++) {
            result.push(data[dataIndex]);
        }

        return result;
    }, [data, enableHeader, groups]);

    const groupHeaderRowCount = useMemo(() => {
        if (!groups || groups.length === 0) return 0;
        return groups.length;
    }, [groups]);

    return useMemo(
        () => ({
            dataWithGroups,
            groupHeaderRowCount,
        }),
        [dataWithGroups, groupHeaderRowCount],
    );
};
