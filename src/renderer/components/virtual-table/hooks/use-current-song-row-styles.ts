import type { AgGridReact as AgGridReactType } from '@ag-grid-community/react/lib/agGridReact';

import { RowClassRules, RowNode } from '@ag-grid-community/core';
import { MutableRefObject, useEffect, useMemo, useRef } from 'react';

import { usePlayerEvents } from '/@/renderer/features/player/audio-player/listener/use-player-events';
import { useAppFocus } from '/@/renderer/hooks';
import { usePlayerSong } from '/@/renderer/store';
import { Song } from '/@/shared/types/domain-types';

interface UseCurrentSongRowStylesProps {
    tableRef: MutableRefObject<AgGridReactType | null>;
}

export const useCurrentSongRowStyles = ({ tableRef }: UseCurrentSongRowStylesProps) => {
    const currentSong = usePlayerSong();
    const isFocused = useAppFocus();
    const isFocusedRef = useRef<boolean>(isFocused);

    useEffect(() => {
        // Redraw rows if the app focus changes
        if (isFocusedRef.current !== isFocused) {
            isFocusedRef.current = isFocused;
            if (tableRef?.current) {
                const { api, columnApi } = tableRef?.current || {};
                if (api == null || columnApi == null) {
                    return;
                }

                const currentNode = currentSong?.id ? api.getRowNode(currentSong.id) : undefined;

                const rowNodes = [currentNode].filter((e) => e !== undefined) as RowNode<any>[];

                if (rowNodes) {
                    api.redrawRows({ rowNodes });
                }
            }
        }
    }, [currentSong?.id, isFocused, tableRef]);

    const rowClassRules = useMemo<RowClassRules<Song> | undefined>(() => {
        return {
            'current-song': (params) => {
                return (
                    currentSong?.id !== undefined &&
                    params?.data?.id === currentSong?.id &&
                    params?.data?.albumId === currentSong?.albumId
                );
            },
        };
    }, [currentSong?.albumId, currentSong?.id]);

    usePlayerEvents(
        {
            onCurrentSongChange: (properties, prev) => {
                const song = properties.song;
                const previousSong = prev.song;

                if (tableRef?.current) {
                    const { api, columnApi } = tableRef?.current || {};
                    if (api == null || columnApi == null) {
                        return;
                    }

                    const currentNode = song?.id ? api.getRowNode(song.id) : undefined;

                    const previousNode = previousSong?.id
                        ? api.getRowNode(previousSong?.id)
                        : undefined;

                    const rowNodes = [currentNode, previousNode].filter(
                        (e) => e !== undefined,
                    ) as RowNode<any>[];

                    api.redrawRows({ rowNodes });
                }
            },
            onPlayerStatus: (properties) => {
                const song = properties.song;

                if (tableRef?.current) {
                    const { api, columnApi } = tableRef?.current || {};
                    if (api == null || columnApi == null) {
                        return;
                    }

                    const currentNode = song?.id ? api.getRowNode(song.id) : undefined;
                    const rowNodes = [currentNode].filter((e) => e !== undefined) as RowNode<any>[];

                    api.redrawRows({ rowNodes });
                }
            },
        },
        [tableRef],
    );

    return {
        rowClassRules,
    };
};
