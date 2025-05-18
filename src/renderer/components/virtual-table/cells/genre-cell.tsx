import type { AlbumArtist, Artist } from '/@/renderer/api/types';
import type { ICellRendererParams } from '@ag-grid-community/core';

import React from 'react';
import { generatePath, Link } from 'react-router-dom';

import { Separator } from '/@/renderer/components/separator';
import { Text } from '/@/renderer/components/text';
import { CellContainer } from '/@/renderer/components/virtual-table/cells/generic-cell';
import { useGenreRoute } from '/@/renderer/hooks/use-genre-route';

export const GenreCell = ({ data, value }: ICellRendererParams) => {
    const genrePath = useGenreRoute();
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
                        <Text
                            $link
                            $secondary
                            component={Link}
                            overflow="hidden"
                            size="md"
                            to={generatePath(genrePath, { genreId: item.id })}
                        >
                            {item.name || '—'}
                        </Text>
                    </React.Fragment>
                ))}
            </Text>
        </CellContainer>
    );
};
