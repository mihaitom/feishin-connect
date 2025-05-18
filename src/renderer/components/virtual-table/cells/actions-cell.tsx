import type { ICellRendererParams } from '@ag-grid-community/core';

import { RiMoreFill } from 'react-icons/ri';

import { Button } from '/@/renderer/components/button';
import { CellContainer } from '/@/renderer/components/virtual-table/cells/generic-cell';

export const ActionsCell = ({ api, context }: ICellRendererParams) => {
    return (
        <CellContainer $position="center">
            <Button
                compact
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    context.onCellContextMenu(undefined, api, e);
                }}
                variant="subtle"
            >
                <RiMoreFill />
            </Button>
        </CellContainer>
    );
};
