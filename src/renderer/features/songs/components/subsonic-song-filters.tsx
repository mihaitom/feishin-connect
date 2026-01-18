import { ChangeEvent, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useListContext } from '/@/renderer/context/list-context';
import { useGenreList } from '/@/renderer/features/genres/api/genres-api';
import { GenreMultiSelectRow } from '/@/renderer/features/shared/components/multi-select-rows';
import { useSongListFilters } from '/@/renderer/features/songs/hooks/use-song-list-filters';
import { Button } from '/@/shared/components/button/button';
import { Divider } from '/@/shared/components/divider/divider';
import { Group } from '/@/shared/components/group/group';
import { VirtualMultiSelect } from '/@/shared/components/multi-select/virtual-multi-select';
import { Stack } from '/@/shared/components/stack/stack';
import { Switch } from '/@/shared/components/switch/switch';
import { Text } from '/@/shared/components/text/text';

export const SubsonicSongFilters = () => {
    const { t } = useTranslation();
    const { clear, query, setFavorite, setGenreId } = useSongListFilters();

    const { customFilters } = useListContext();

    const isGenrePage = customFilters?.genreIds !== undefined;

    const genreListQuery = useGenreList();

    const genreList = useMemo(() => {
        if (!genreListQuery.data) return [];
        return genreListQuery.data.items.map((genre) => ({
            albumCount: genre.albumCount,
            label: genre.name,
            songCount: genre.songCount,
            value: genre.id,
        }));
    }, [genreListQuery.data]);

    const selectedGenreIds = useMemo(() => query.genreIds || [], [query.genreIds]);

    const handleGenresFilter = useCallback(
        (e: null | string[]) => {
            if (e && e.length > 0) {
                setGenreId([e[0]]);
            } else {
                setGenreId(null);
            }
        },
        [setGenreId],
    );

    const genreFilterLabel = useMemo(() => {
        return (
            <Text fw={500} size="sm">
                {t('entity.genre', { count: 1, postProcess: 'sentenceCase' })}
            </Text>
        );
    }, [t]);

    const toggleFilters = useMemo(
        () => [
            {
                label: t('filter.isFavorited', { postProcess: 'sentenceCase' }),
                onChange: (e: ChangeEvent<HTMLInputElement>) => {
                    const favoriteValue = e.target.checked ? true : undefined;
                    setFavorite(favoriteValue ?? null);
                },
                value: query.favorite,
            },
        ],
        [t, query.favorite, setFavorite],
    );

    return (
        <Stack px="md" py="md">
            {toggleFilters.map((filter) => (
                <Group justify="space-between" key={`ss-filter-${filter.label}`}>
                    <Text>{filter.label}</Text>
                    <Switch checked={filter.value ?? false} onChange={filter.onChange} />
                </Group>
            ))}
            {!isGenrePage && (
                <>
                    <Divider my="md" />
                    <VirtualMultiSelect
                        displayCountType="song"
                        height={220}
                        label={genreFilterLabel}
                        onChange={handleGenresFilter}
                        options={genreList}
                        RowComponent={GenreMultiSelectRow}
                        singleSelect={true}
                        value={selectedGenreIds}
                    />
                </>
            )}
            <Divider my="md" />
            <Button fullWidth onClick={clear} variant="subtle">
                {t('common.reset', { postProcess: 'sentenceCase' })}
            </Button>
        </Stack>
    );
};
