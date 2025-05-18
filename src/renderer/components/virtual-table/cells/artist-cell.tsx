import type { AlbumArtist, Artist } from '/@/renderer/api/types';
import type { ICellRendererParams } from '@ag-grid-community/core';

import React from 'react';
import { generatePath } from 'react-router';
import { Link } from 'react-router-dom';

import { Separator } from '/@/renderer/components/separator';
import { Skeleton } from '/@/renderer/components/skeleton';
import { Text } from '/@/renderer/components/text';
import { CellContainer } from '/@/renderer/components/virtual-table/cells/generic-cell';
import { AppRoute } from '/@/renderer/router/routes';

export const ArtistCell = ({ data, value }: ICellRendererParams) => {
    if (value === undefined) {
        return (
            <CellContainer $position="left">
                <Skeleton
                    height="1rem"
                    width="80%"
                />
            </CellContainer>
        );
    }

    return (
        <CellContainer $position="left">
            <Text
                $secondary
                overflow="hidden"
                size="md"
            >
                {value?.map((item: AlbumArtist | Artist, index: number) => (
                    <React.Fragment key={`row-${item.id}-${data.uniqueId}`}>
                        {index > 0 && <Separator />}
                        {item.id ? (
                            <Text
                                $link
                                $secondary
                                component={Link}
                                overflow="hidden"
                                size="md"
                                to={generatePath(AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL, {
                                    albumArtistId: item.id,
                                })}
                            >
                                {item.name || '—'}
                            </Text>
                        ) : (
                            <Text
                                $secondary
                                overflow="hidden"
                                size="md"
                            >
                                {item.name || '—'}
                            </Text>
                        )}
                    </React.Fragment>
                ))}
            </Text>
        </CellContainer>
    );
};
