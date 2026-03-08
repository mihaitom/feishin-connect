import { closeAllModals, ContextModalProps } from '@mantine/modals';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useUpdatePlaylist } from '/@/renderer/features/playlists/mutations/update-playlist-mutation';
import { useCurrentServerId } from '/@/renderer/store';
import { ConfirmModal } from '/@/shared/components/modal/modal';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';
import { UpdatePlaylistBody } from '/@/shared/types/domain-types';

export const SaveAndReplaceContextModal = ({
    innerProps,
}: ContextModalProps<{ playlistId: string; updateBody: UpdatePlaylistBody }>) => {
    const { t } = useTranslation();
    const { playlistId, updateBody } = innerProps;
    const serverId = useCurrentServerId();

    const updatePlaylistMutation = useUpdatePlaylist({});

    const handleConfirm = useCallback(() => {
        if (!serverId || !playlistId) {
            console.error('serverId or playlistId is not defined');
            return;
        }

        updatePlaylistMutation.mutate(
            {
                apiClientProps: { serverId },
                body: updateBody,
                query: { id: playlistId },
            },
            {
                onError: (err) => {
                    console.error(err);
                    toast.error({
                        message: err.message,
                        title: t('error.genericError', {
                            postProcess: 'sentenceCase',
                        }),
                    });
                },
                onSuccess: () => {
                    closeAllModals();
                    toast.success({
                        message: t('form.editPlaylist.success', {
                            postProcess: 'sentenceCase',
                        }),
                    });
                },
            },
        );
    }, [t, serverId, playlistId, updateBody, updatePlaylistMutation]);

    return (
        <ConfirmModal loading={updatePlaylistMutation.isPending} onConfirm={handleConfirm}>
            <Text>{t('form.editPlaylist.editNote', { postProcess: 'sentenceCase' })}</Text>
        </ConfirmModal>
    );
};
