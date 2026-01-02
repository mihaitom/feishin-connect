import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { songsQueries } from '/@/renderer/features/songs/api/songs-api';
import {
    useCurrentServerId,
    useGeneralSettings,
    useSettingsStore,
    useSettingsStoreActions,
} from '/@/renderer/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Code } from '/@/shared/components/code/code';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { Played } from '/@/shared/types/domain-types';

export const PathSettings = () => {
    const { t } = useTranslation();
    const serverId = useCurrentServerId();
    const randomSong = useQuery({
        ...songsQueries.random({
            query: { limit: 1, played: Played.All },
            serverId,
        }),
        gcTime: Infinity,
        staleTime: Infinity,
    });

    const { pathReplace, pathReplaceWith } = useGeneralSettings();
    const { setSettings } = useSettingsStoreActions();

    return (
        <Stack>
            <Group>
                <Text>{t('setting.pathReplace', { postProcess: 'sentenceCase' })}</Text>
                <ActionIcon
                    icon="refresh"
                    loading={randomSong.isFetching}
                    onClick={() => randomSong.refetch()}
                    size="xs"
                    variant="transparent"
                />
            </Group>
            <Code>
                <Text isMuted size="md">
                    {randomSong.data?.items[0]?.path || ''}
                </Text>
            </Code>
            <Group grow>
                <TextInput
                    onChange={(e) =>
                        setSettings({
                            general: {
                                ...useSettingsStore.getState().general,
                                pathReplace: e.currentTarget.value,
                            },
                        })
                    }
                    placeholder={t('setting.pathReplace_optionRemovePrefix', {
                        postProcess: 'sentenceCase',
                    })}
                    value={pathReplace}
                />
                <TextInput
                    onChange={(e) =>
                        setSettings({
                            general: {
                                ...useSettingsStore.getState().general,
                                pathReplaceWith: e.currentTarget.value,
                            },
                        })
                    }
                    placeholder={t('setting.pathReplace_optionAddPrefix', {
                        postProcess: 'sentenceCase',
                    })}
                    value={pathReplaceWith}
                />
            </Group>
        </Stack>
    );
};
