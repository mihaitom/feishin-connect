import { useForm } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import clone from 'lodash/clone';
import get from 'lodash/get';
import setWith from 'lodash/setWith';
import { nanoid } from 'nanoid';
import { forwardRef, Ref, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { QueryBuilder } from '/@/renderer/components/query-builder';
import { playlistsQueries } from '/@/renderer/features/playlists/api/playlists-api';
import { convertNDQueryToQueryGroup } from '/@/renderer/features/playlists/utils';
import { useCurrentServer } from '/@/renderer/store';
import {
    NDSongQueryBooleanOperators,
    NDSongQueryDateOperators,
    NDSongQueryFields,
    NDSongQueryNumberOperators,
    NDSongQueryPlaylistOperators,
    NDSongQueryStringOperators,
} from '/@/shared/api/navidrome/navidrome-types';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Flex } from '/@/shared/components/flex/flex';
import { Group } from '/@/shared/components/group/group';
import { NumberInput } from '/@/shared/components/number-input/number-input';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Select } from '/@/shared/components/select/select';
import { Stack } from '/@/shared/components/stack/stack';
import { PlaylistListSort, SongListSort, SortOrder } from '/@/shared/types/domain-types';
import { QueryBuilderGroup, QueryBuilderRule } from '/@/shared/types/types';

type AddArgs = {
    groupIndex: number[];
    level: number;
};

type DeleteArgs = {
    groupIndex: number[];
    level: number;
    uniqueId: string;
};

interface PlaylistQueryBuilderProps {
    limit?: number;
    playlistId?: string;
    query: any;
    sortBy: SongListSort | SongListSort[];
    sortOrder: 'asc' | 'desc';
}

type SortEntry = {
    field: string;
    order: 'asc' | 'desc';
};

const DEFAULT_QUERY = {
    group: [],
    rules: [
        {
            field: '',
            operator: '',
            uniqueId: nanoid(),
            value: '',
        },
    ],
    type: 'all' as 'all' | 'any',
    uniqueId: nanoid(),
};

export type PlaylistQueryBuilderRef = {
    getFilters: () => {
        extraFilters: {
            limit?: number;
            sortBy?: string[];
            sortOrder?: string;
        };
        filters: QueryBuilderGroup;
    };
};

export const PlaylistQueryBuilder = forwardRef(
    (
        { limit, playlistId, query, sortBy, sortOrder }: PlaylistQueryBuilderProps,
        ref: Ref<PlaylistQueryBuilderRef>,
    ) => {
        const { t } = useTranslation();
        const server = useCurrentServer();
        const [filters, setFilters] = useState<QueryBuilderGroup>(
            query ? convertNDQueryToQueryGroup(query) : DEFAULT_QUERY,
        );

        const { data: playlists } = useQuery(
            playlistsQueries.list({
                query: { sortBy: PlaylistListSort.NAME, sortOrder: SortOrder.ASC, startIndex: 0 },
                serverId: server?.id,
            }),
        );

        const playlistData = useMemo(() => {
            if (!playlists) return [];

            return playlists.items
                .filter((p) => {
                    if (!playlistId) return true;
                    return p.id !== playlistId;
                })
                .map((p) => ({
                    label: p.name,
                    value: p.id,
                }));
        }, [playlistId, playlists]);

        // Parse sortBy and sortOrder into array of sort entries
        // Handle new syntax: comma-separated fields with +/- prefix (e.g., "+album,-year")
        // Or old syntax: sortBy array + single sortOrder
        const parseSortEntries = (): SortEntry[] => {
            if (Array.isArray(sortBy) && sortBy.length > 0) {
                const firstSort = sortBy[0];
                // Check if first entry is a string with commas (new syntax as single string)
                if (typeof firstSort === 'string' && firstSort.includes(',')) {
                    // Split the comma-separated string and parse each field
                    return firstSort.split(',').map((s) => {
                        const trimmed = s.trim();
                        const field =
                            trimmed.startsWith('+') || trimmed.startsWith('-')
                                ? trimmed.slice(1)
                                : trimmed;
                        const order = trimmed.startsWith('-') ? 'desc' : 'asc';
                        return { field, order };
                    });
                }
                // Check if first entry has +/- prefix (new syntax as array of prefixed strings)
                if (
                    typeof firstSort === 'string' &&
                    (firstSort.startsWith('+') || firstSort.startsWith('-'))
                ) {
                    return sortBy.map((s) => {
                        const field = s.startsWith('+') || s.startsWith('-') ? s.slice(1) : s;
                        const order = s.startsWith('-') ? 'desc' : 'asc';
                        return { field, order };
                    });
                }
                // Old syntax: array of fields with single order
                return sortBy.map((field) => ({ field, order: sortOrder }));
            }
            if (sortBy && typeof sortBy === 'string') {
                // Check if it's new syntax with +/- prefix
                if (sortBy.includes(',') || sortBy.startsWith('+') || sortBy.startsWith('-')) {
                    return sortBy.split(',').map((s) => {
                        const trimmed = s.trim();
                        const field =
                            trimmed.startsWith('+') || trimmed.startsWith('-')
                                ? trimmed.slice(1)
                                : trimmed;
                        const order = trimmed.startsWith('-') ? 'desc' : 'asc';
                        return { field, order };
                    });
                }
                // Single field, use provided sortOrder
                return [{ field: sortBy, order: sortOrder }];
            }
            // Default
            return [{ field: 'dateAdded', order: 'asc' }];
        };

        const extraFiltersForm = useForm({
            initialValues: {
                limit,
                sortEntries: parseSortEntries(),
            },
        });

        // Convert sort entries to new syntax: comma-separated with +/- prefix
        const convertSortEntriesToSortString = (entries: SortEntry[]): string => {
            return entries
                .filter((entry) => entry.field) // Filter out empty fields
                .map((entry) => {
                    const prefix = entry.order === 'desc' ? '-' : '+';
                    return `${prefix}${entry.field}`;
                })
                .join(',');
        };

        useImperativeHandle(ref, () => ({
            getFilters: () => {
                const sortString = convertSortEntriesToSortString(
                    extraFiltersForm.values.sortEntries,
                );
                return {
                    extraFilters: {
                        limit: extraFiltersForm.values.limit,
                        sortBy: sortString ? [sortString] : undefined,
                        // sortOrder is now optional and embedded in sortBy
                    },
                    filters,
                };
            },
        }));

        const handleResetFilters = () => {
            if (query) {
                setFilters(convertNDQueryToQueryGroup(query));
            } else {
                setFilters(DEFAULT_QUERY);
            }
        };

        const handleClearFilters = () => {
            setFilters(DEFAULT_QUERY);
        };

        const setFilterHandler = (newFilters: QueryBuilderGroup) => {
            setFilters(newFilters);
        };

        const handleAddRuleGroup = (args: AddArgs) => {
            const { groupIndex, level } = args;
            const filtersCopy = clone(filters);

            const getPath = (level: number) => {
                if (level === 0) return 'group';

                const str: string[] = [];
                for (const index of groupIndex) {
                    str.push(`group[${index}]`);
                }

                return `${str.join('.')}.group`;
            };

            const path = getPath(level);
            const updatedFilters = setWith(
                filtersCopy,
                path,
                [
                    ...get(filtersCopy, path),
                    {
                        group: [],
                        rules: [
                            {
                                field: '',
                                operator: '',
                                uniqueId: nanoid(),
                                value: '',
                            },
                        ],
                        type: 'any',
                        uniqueId: nanoid(),
                    },
                ],
                clone,
            );

            setFilterHandler(updatedFilters);
        };

        const handleDeleteRuleGroup = (args: DeleteArgs) => {
            const { groupIndex, level, uniqueId } = args;
            const filtersCopy = clone(filters);

            const getPath = (level: number) => {
                if (level === 0) return 'group';

                const str: string[] = [];
                for (let i = 0; i < groupIndex.length; i += 1) {
                    if (i !== groupIndex.length - 1) {
                        str.push(`group[${groupIndex[i]}]`);
                    } else {
                        str.push(`group`);
                    }
                }

                return `${str.join('.')}`;
            };

            const path = getPath(level);

            const updatedFilters = setWith(
                filtersCopy,
                path,
                [
                    ...get(filtersCopy, path).filter(
                        (group: QueryBuilderGroup) => group.uniqueId !== uniqueId,
                    ),
                ],
                clone,
            );

            setFilterHandler(updatedFilters);
        };

        const getRulePath = (level: number, groupIndex: number[]) => {
            if (level === 0) return 'rules';

            const str: string[] = [];
            for (const index of groupIndex) {
                str.push(`group[${index}]`);
            }

            return `${str.join('.')}.rules`;
        };

        const handleAddRule = (args: AddArgs) => {
            const { groupIndex, level } = args;
            const filtersCopy = clone(filters);

            const path = getRulePath(level, groupIndex);
            const updatedFilters = setWith(
                filtersCopy,
                path,
                [
                    ...get(filtersCopy, path),
                    {
                        field: '',
                        operator: '',
                        uniqueId: nanoid(),
                        value: null,
                    },
                ],
                clone,
            );

            setFilterHandler(updatedFilters);
        };

        const handleDeleteRule = (args: DeleteArgs) => {
            const { groupIndex, level, uniqueId } = args;
            const filtersCopy = clone(filters);

            const path = getRulePath(level, groupIndex);
            const updatedFilters = setWith(
                filtersCopy,
                path,
                get(filtersCopy, path).filter(
                    (rule: QueryBuilderRule) => rule.uniqueId !== uniqueId,
                ),
                clone,
            );

            setFilterHandler(updatedFilters);
        };

        const handleChangeField = (args: any) => {
            const { groupIndex, level, uniqueId, value } = args;
            const filtersCopy = clone(filters);

            const path = getRulePath(level, groupIndex);
            const updatedFilters = setWith(
                filtersCopy,
                path,
                get(filtersCopy, path).map((rule: QueryBuilderGroup) => {
                    if (rule.uniqueId !== uniqueId) return rule;
                    return {
                        ...rule,
                        field: value,
                        operator: '',
                        value: '',
                    };
                }),
                clone,
            );

            setFilterHandler(updatedFilters);
        };

        const handleChangeType = (args: any) => {
            const { groupIndex, level, value } = args;

            const filtersCopy = clone(filters);

            if (level === 0) {
                return setFilterHandler({ ...filtersCopy, type: value });
            }

            const getTypePath = () => {
                const str: string[] = [];
                for (let i = 0; i < groupIndex.length; i += 1) {
                    str.push(`group[${groupIndex[i]}]`);
                }

                return `${str.join('.')}`;
            };

            const path = getTypePath();
            const updatedFilters = setWith(
                filtersCopy,
                path,
                {
                    ...get(filtersCopy, path),
                    type: value,
                },
                clone,
            );

            return setFilterHandler(updatedFilters);
        };

        const handleChangeOperator = (args: any) => {
            const { groupIndex, level, uniqueId, value } = args;
            const filtersCopy = clone(filters);

            const path = getRulePath(level, groupIndex);
            const updatedFilters = setWith(
                filtersCopy,
                path,
                get(filtersCopy, path).map((rule: QueryBuilderRule) => {
                    if (rule.uniqueId !== uniqueId) return rule;
                    return {
                        ...rule,
                        operator: value,
                    };
                }),
                clone,
            );

            setFilterHandler(updatedFilters);
        };

        const handleChangeValue = (args: any) => {
            const { groupIndex, level, uniqueId, value } = args;
            const filtersCopy = clone(filters);

            const path = getRulePath(level, groupIndex);
            const updatedFilters = setWith(
                filtersCopy,
                path,
                get(filtersCopy, path).map((rule: QueryBuilderRule) => {
                    if (rule.uniqueId !== uniqueId) return rule;
                    return {
                        ...rule,
                        value,
                    };
                }),
                clone,
            );

            setFilterHandler(updatedFilters);
        };

        const sortOptions = [
            {
                label: t('filter.random', { postProcess: 'titleCase' }),
                type: 'string',
                value: 'random',
            },
            ...NDSongQueryFields,
        ];

        const handleAddSortEntry = () => {
            extraFiltersForm.insertListItem('sortEntries', { field: '', order: 'asc' });
        };

        const handleRemoveSortEntry = (index: number) => {
            extraFiltersForm.removeListItem('sortEntries', index);
        };

        const handleSortFieldChange = (index: number, value: string) => {
            extraFiltersForm.setFieldValue(`sortEntries.${index}.field`, value);
        };

        const handleSortOrderChange = (index: number, value: 'asc' | 'desc') => {
            extraFiltersForm.setFieldValue(`sortEntries.${index}.order`, value);
        };

        return (
            <Flex direction="column" h="calc(100% - 2rem)" justify="space-between">
                <ScrollArea>
                    <Stack gap="md" p="1rem">
                        <QueryBuilder
                            data={filters}
                            filters={NDSongQueryFields}
                            groupIndex={[]}
                            level={0}
                            onAddRule={handleAddRule}
                            onAddRuleGroup={handleAddRuleGroup}
                            onChangeField={handleChangeField}
                            onChangeOperator={handleChangeOperator}
                            onChangeType={handleChangeType}
                            onChangeValue={handleChangeValue}
                            onClearFilters={handleClearFilters}
                            onDeleteRule={handleDeleteRule}
                            onDeleteRuleGroup={handleDeleteRuleGroup}
                            onResetFilters={handleResetFilters}
                            operators={{
                                boolean: NDSongQueryBooleanOperators,
                                date: NDSongQueryDateOperators,
                                number: NDSongQueryNumberOperators,
                                playlist: NDSongQueryPlaylistOperators,
                                string: NDSongQueryStringOperators,
                            }}
                            playlists={playlistData}
                            uniqueId={filters.uniqueId}
                        />
                        <Group align="flex-end" gap="sm" w="100%" wrap="nowrap">
                            <Stack gap="xs" w="100%">
                                {extraFiltersForm.values.sortEntries.map((entry, index) => (
                                    <Group align="flex-end" gap="sm" key={index} wrap="nowrap">
                                        <Select
                                            data={sortOptions}
                                            label={
                                                index === 0
                                                    ? t('common.sort', { postProcess: 'titleCase' })
                                                    : ''
                                            }
                                            onChange={(value) =>
                                                handleSortFieldChange(index, value || '')
                                            }
                                            searchable
                                            value={entry.field}
                                            width={200}
                                        />
                                        <Select
                                            data={[
                                                {
                                                    label: t('common.ascending', {
                                                        postProcess: 'sentenceCase',
                                                    }),
                                                    value: 'asc',
                                                },
                                                {
                                                    label: t('common.descending', {
                                                        postProcess: 'sentenceCase',
                                                    }),
                                                    value: 'desc',
                                                },
                                            ]}
                                            label={
                                                index === 0
                                                    ? t('common.sortOrder', {
                                                          postProcess: 'titleCase',
                                                      })
                                                    : ''
                                            }
                                            onChange={(value) =>
                                                handleSortOrderChange(
                                                    index,
                                                    (value as 'asc' | 'desc') || 'asc',
                                                )
                                            }
                                            value={entry.order}
                                            width={125}
                                        />
                                        {extraFiltersForm.values.sortEntries.length > 1 && (
                                            <ActionIcon
                                                icon="minus"
                                                onClick={() => handleRemoveSortEntry(index)}
                                                variant="subtle"
                                            />
                                        )}
                                        {index ===
                                            extraFiltersForm.values.sortEntries.length - 1 && (
                                            <ActionIcon
                                                icon="plus"
                                                onClick={handleAddSortEntry}
                                                variant="subtle"
                                            />
                                        )}
                                    </Group>
                                ))}
                            </Stack>
                            <NumberInput
                                label={t('common.limit', { postProcess: 'titleCase' })}
                                maxWidth="20%"
                                width={75}
                                {...extraFiltersForm.getInputProps('limit')}
                            />
                        </Group>
                    </Stack>
                </ScrollArea>
            </Flex>
        );
    },
);
