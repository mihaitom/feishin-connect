import { ActionSheet } from '/@/remote/components/action-sheet';
import { useQueueReplaceConfirm, useRemoteLibraryStore } from '/@/remote/store/library';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';

// Mounted once (shell.tsx), not per-page — use-confirmed-send.ts is called
// from list rows scattered across every tab plus the long-press action
// sheets, so the pending confirmation itself lives in the shared library
// store rather than local state anywhere.
export const QueueReplaceConfirmSheet = () => {
    const pending = useQueueReplaceConfirm();
    const clear = useRemoteLibraryStore((state) => state.actions.clearQueueReplaceConfirm);

    return (
        <ActionSheet onClose={clear} opened={!!pending}>
            <Stack gap="md" p="md">
                <Text fw={700}>Discard the current queue?</Text>
                <Text isMuted size="sm">
                    This will remove all items from the current queue.
                </Text>
                <Group gap="sm" grow>
                    <Button onClick={clear} variant="default">
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            pending?.();
                            clear();
                        }}
                        variant="filled"
                    >
                        Confirm
                    </Button>
                </Group>
            </Stack>
        </ActionSheet>
    );
};
