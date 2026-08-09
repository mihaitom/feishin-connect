import { useState } from 'react';

import { Button } from '/@/shared/components/button/button';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { useDebouncedValue } from '/@/shared/hooks/use-debounced-value';
import { ActionSheet } from '/@/shared/mobile-ui/components/action-sheet';
import { MobilePlaylistItem, UseMobileSearch } from '/@/shared/mobile-ui/types';

interface AddToPlaylistSheetProps {
    onSelect: (playlistId: string, playlistName: string) => void;
    usePlaylistSearch: UseMobileSearch<MobilePlaylistItem>;
}

export const AddToPlaylistSheet = ({ onSelect, usePlaylistSearch }: AddToPlaylistSheetProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
    const { hasMore, items, loadMore } = usePlaylistSearch(debouncedSearchTerm ?? '');

    return (
        <Stack gap={4} px={8}>
            <TextInput
                autoFocus
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                placeholder="Search playlists…"
                value={searchTerm}
            />
            {items.length === 0 && (
                <Text isMuted py="md" ta="center">
                    No playlists found
                </Text>
            )}
            {items.map((playlist) => (
                <ActionSheet.Item
                    key={playlist.id}
                    leftIcon="playlist"
                    onClick={() => onSelect(playlist.id, playlist.name)}
                >
                    {playlist.name}
                </ActionSheet.Item>
            ))}
            {hasMore && (
                <Button onClick={loadMore} variant="default">
                    Load more
                </Button>
            )}
        </Stack>
    );
};
