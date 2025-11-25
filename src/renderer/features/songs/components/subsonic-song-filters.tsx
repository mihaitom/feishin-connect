import debounce from 'lodash/debounce';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SelectWithInvalidData } from '/@/renderer/components/select-with-invalid-data';
import { useGenreList } from '/@/renderer/features/genres/api/genres-api';
import { useSongListFilters } from '/@/renderer/features/songs/hooks/use-song-list-filters';
import { SongListFilter } from '/@/renderer/store';
import { Divider } from '/@/shared/components/divider/divider';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { YesNoSelect } from '/@/shared/components/yes-no-select/yes-no-select';

interface SubsonicSongFiltersProps {
    customFilters?: Partial<SongListFilter>;
}

export const SubsonicSongFilters = ({ customFilters }: SubsonicSongFiltersProps) => {
    const { t } = useTranslation();
    const { query, setFavorite, setGenreId } = useSongListFilters();

    const isGenrePage = customFilters?.genreIds !== undefined;

    const genreListQuery = useGenreList();

    const genreList = useMemo(() => {
        if (!genreListQuery.data) return [];
        return genreListQuery.data.items.map((genre) => ({
            label: genre.name,
            value: genre.id,
        }));
    }, [genreListQuery.data]);

    const handleGenresFilter = debounce((e: null | string) => {
        setGenreId(e ? [e] : null);
    }, 250);

    const toggleFilters = [
        {
            label: t('filter.isFavorited', { postProcess: 'sentenceCase' }),
            onChange: (favorite: boolean | undefined) => {
                setFavorite(favorite ?? null);
            },
            value: query.favorite,
        },
    ];

    return (
        <Stack p="0.8rem">
            {toggleFilters.map((filter) => (
                <Group justify="space-between" key={`ss-filter-${filter.label}`}>
                    <Text>{filter.label}</Text>
                    <YesNoSelect onChange={filter.onChange} size="xs" value={filter.value} />
                </Group>
            ))}
            <Divider my="0.5rem" />
            <Group grow>
                {!isGenrePage && (
                    <SelectWithInvalidData
                        clearable
                        data={genreList}
                        defaultValue={query.genreId ? query.genreId[0] : undefined}
                        label={t('entity.genre', { count: 1, postProcess: 'titleCase' })}
                        onChange={handleGenresFilter}
                        searchable
                        width={150}
                    />
                )}
            </Group>
        </Stack>
    );
};
