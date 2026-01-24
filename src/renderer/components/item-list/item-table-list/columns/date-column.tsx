import { useMemo } from 'react';

import {
    ColumnNullFallback,
    ColumnSkeletonFixed,
    ItemTableListInnerColumn,
    TableColumnTextContainer,
} from '/@/renderer/components/item-list/item-table-list/item-table-list-column';
import {
    formatDateAbsolute,
    formatDateAbsoluteUTC,
    formatDateRelative,
    formatHrDateTime,
} from '/@/renderer/utils/format';
import { SEPARATOR_STRING } from '/@/shared/api/utils';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { Tooltip } from '/@/shared/components/tooltip/tooltip';
import { TableColumn } from '/@/shared/types/types';

const getDateTooltipLabel = (utcString: string) => {
    return (
        <Stack gap="xs" justify="center">
            <Text size="md" ta="center">
                {formatHrDateTime(utcString)}
            </Text>
            <Text isMuted size="sm" ta="center">
                {utcString}
            </Text>
        </Stack>
    );
};

const DateColumnBase = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const row: string | undefined = (rowItem as any)?.[props.columns[props.columnIndex].id];

    const { formattedDate, tooltipLabel } = useMemo(() => {
        if (typeof row === 'string' && row) {
            return {
                formattedDate: formatDateAbsolute(row),
                tooltipLabel: getDateTooltipLabel(row),
            };
        }
        return { formattedDate: null, tooltipLabel: null };
    }, [row]);

    if (typeof row === 'string' && row) {
        return (
            <TableColumnTextContainer {...props}>
                <Tooltip label={tooltipLabel} multiline={false}>
                    <span>{formattedDate}</span>
                </Tooltip>
            </TableColumnTextContainer>
        );
    }

    if (row === null) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonFixed {...props} />;
};

export const DateColumn = DateColumnBase;

const AbsoluteDateColumnBase = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const row: string | undefined = (rowItem as any)?.[props.columns[props.columnIndex].id];

    const releaseDateContent = useMemo(() => {
        if (props.type === TableColumn.RELEASE_DATE) {
            const item = rowItem as any;
            if (item && 'releaseDate' in item && item.releaseDate) {
                const releaseDate = item.releaseDate;
                const originalDate =
                    'originalDate' in item && item.originalDate && item.originalDate !== releaseDate
                        ? item.originalDate
                        : null;

                if (originalDate) {
                    const formattedOriginalDate = formatDateAbsoluteUTC(originalDate);
                    const formattedReleaseDate = formatDateAbsoluteUTC(releaseDate);
                    const displayText = `${formattedOriginalDate}${SEPARATOR_STRING}${formattedReleaseDate}`;

                    return {
                        displayText,
                        tooltipLabel: getDateTooltipLabel(releaseDate),
                    };
                }

                if (typeof releaseDate === 'string' && releaseDate) {
                    return {
                        displayText: formatDateAbsoluteUTC(releaseDate),
                        tooltipLabel: getDateTooltipLabel(releaseDate),
                    };
                }
            }
        }
        return null;
    }, [props.type, rowItem]);

    const { formattedDate, tooltipLabel } = useMemo(() => {
        if (typeof row === 'string' && row) {
            return {
                formattedDate: formatDateAbsoluteUTC(row),
                tooltipLabel: getDateTooltipLabel(row),
            };
        }
        return { formattedDate: null, tooltipLabel: null };
    }, [row]);

    if (props.type === TableColumn.RELEASE_DATE) {
        if (releaseDateContent) {
            return (
                <TableColumnTextContainer {...props}>
                    <Tooltip label={releaseDateContent.tooltipLabel} multiline={false}>
                        <span>{releaseDateContent.displayText}</span>
                    </Tooltip>
                </TableColumnTextContainer>
            );
        }

        if (row === null) {
            return <ColumnNullFallback {...props} />;
        }

        return <ColumnSkeletonFixed {...props} />;
    }

    if (typeof row === 'string' && row) {
        return (
            <TableColumnTextContainer {...props}>
                <Tooltip label={tooltipLabel} multiline={false}>
                    <span>{formattedDate}</span>
                </Tooltip>
            </TableColumnTextContainer>
        );
    }

    if (row === null) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonFixed {...props} />;
};

export const AbsoluteDateColumn = AbsoluteDateColumnBase;

const RelativeDateColumnBase = (props: ItemTableListInnerColumn) => {
    const rowItem = props.getRowItem?.(props.rowIndex) ?? (props.data as any[])[props.rowIndex];
    const row: string | undefined = (rowItem as any)?.[props.columns[props.columnIndex].id];

    const { formattedDate, tooltipLabel } = useMemo(() => {
        if (typeof row === 'string') {
            return {
                formattedDate: formatDateRelative(row),
                tooltipLabel: getDateTooltipLabel(row),
            };
        }
        return { formattedDate: null, tooltipLabel: null };
    }, [row]);

    if (typeof row === 'string') {
        return (
            <TableColumnTextContainer {...props}>
                <Tooltip label={tooltipLabel} multiline={false}>
                    <span>{formattedDate}</span>
                </Tooltip>
            </TableColumnTextContainer>
        );
    }

    if (row === null) {
        return <ColumnNullFallback {...props} />;
    }

    return <ColumnSkeletonFixed {...props} />;
};

export const RelativeDateColumn = RelativeDateColumnBase;
