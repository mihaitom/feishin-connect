import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RowComponentProps } from 'react-window-v2';

import styles from './multi-select-rows.module.css';

import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { Group } from '/@/shared/components/group/group';
import { VirtualMultiSelectOption } from '/@/shared/components/multi-select/virtual-multi-select';
import { Text } from '/@/shared/components/text/text';
import { LibraryItem } from '/@/shared/types/domain-types';

export function ArtistMultiSelectRow({
    focusedIndex,
    index,
    onToggle,
    options,
    style,
}: RowComponentProps<{
    focusedIndex: null | number;
    onToggle: (value: string) => void;
    options: VirtualMultiSelectOption<{
        albumCount: null | number;
        imageUrl: string | undefined;
    }>[];
    value: string[];
}>) {
    const { t } = useTranslation();

    const handleClick = useCallback(() => {
        onToggle(options[index].value);
    }, [onToggle, options, index]);

    const isFocused = focusedIndex === index;

    return (
        <Group
            className={styles.row}
            gap="sm"
            onClick={handleClick}
            style={{ ...style }}
            {...(isFocused && { 'data-focused': true })}
        >
            <ItemImage
                containerClassName={styles.rowImage}
                itemType={LibraryItem.ARTIST}
                src={options[index].imageUrl}
                type="table"
            />
            <div className={styles.rowContent}>
                <Text isNoSelect overflow="hidden" size="sm">
                    {options[index].label}
                </Text>
                <Text isMuted overflow="hidden" size="xs">
                    {options[index].albumCount ? (
                        <>
                            {options[index].albumCount}{' '}
                            {t('entity.album', { count: options[index].albumCount })}
                        </>
                    ) : (
                        <>&nbsp;</>
                    )}
                </Text>
            </div>
        </Group>
    );
}

export function GenreMultiSelectRow({
    focusedIndex,
    index,
    onToggle,
    options,
    style,
}: RowComponentProps<{
    focusedIndex: null | number;
    onToggle: (value: string) => void;
    options: VirtualMultiSelectOption<{ albumCount: null | number }>[];
    value: string[];
}>) {
    const { t } = useTranslation();

    const handleClick = useCallback(() => {
        onToggle(options[index].value);
    }, [onToggle, options, index]);

    const isFocused = focusedIndex === index;

    return (
        <Group
            className={styles.row}
            gap="sm"
            onClick={handleClick}
            style={{ ...style }}
            {...(isFocused && { 'data-focused': true })}
        >
            <div className={styles.rowContent}>
                <Text isNoSelect overflow="hidden" size="sm">
                    {options[index].label}
                </Text>
                <Text isMuted overflow="hidden" size="xs">
                    {options[index].albumCount ? (
                        <>
                            {options[index].albumCount}{' '}
                            {t('entity.album', { count: options[index].albumCount })}
                        </>
                    ) : (
                        <>&nbsp;</>
                    )}
                </Text>
            </div>
        </Group>
    );
}
