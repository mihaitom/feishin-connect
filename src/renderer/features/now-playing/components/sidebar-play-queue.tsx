import { useRef, useState } from 'react';

import styles from './sidebar-play-queue.module.css';

import { ItemListHandle } from '/@/renderer/components/item-list/types';
import { Lyrics } from '/@/renderer/features/lyrics/lyrics';
import { PlayQueue } from '/@/renderer/features/now-playing/components/play-queue';
import { PlayQueueListControls } from '/@/renderer/features/now-playing/components/play-queue-list-controls';
import { useLyricsSettings } from '/@/renderer/store';
import { Divider } from '/@/shared/components/divider/divider';
import { Flex } from '/@/shared/components/flex/flex';
import { Stack } from '/@/shared/components/stack/stack';
import { ItemListKey } from '/@/shared/types/types';

export const SidebarPlayQueue = () => {
    const tableRef = useRef<ItemListHandle | null>(null);
    const [search, setSearch] = useState<string | undefined>(undefined);
    const { showLyricsInSidebar } = useLyricsSettings();

    return (
        <Stack gap={0} h="100%" id="sidebar-play-queue-container" pos="relative" w="100%">
            <PlayQueueListControls
                handleSearch={setSearch}
                searchTerm={search}
                tableRef={tableRef}
                type={ItemListKey.SIDE_QUEUE}
            />
            <Flex direction="column" style={{ flex: 1, minHeight: 0 }}>
                <div className={styles.playQueueSection}>
                    <PlayQueue
                        listKey={ItemListKey.SIDE_QUEUE}
                        ref={tableRef}
                        searchTerm={search}
                    />
                </div>
                {showLyricsInSidebar && (
                    <>
                        <Divider />
                        <div className={styles.lyricsSection}>
                            <Lyrics />
                        </div>
                    </>
                )}
            </Flex>
        </Stack>
    );
};
