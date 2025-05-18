import { Group } from '@mantine/core';
import { DragControls, Reorder, useDragControls } from 'framer-motion';
import { MdDragIndicator } from 'react-icons/md';

import { Checkbox } from '/@/renderer/components';

const DragHandle = ({ dragControls }: { dragControls: DragControls }) => {
    return (
        <MdDragIndicator
            color="white"
            onPointerDown={(event) => dragControls.start(event)}
            style={{ cursor: 'grab' }}
        />
    );
};

export interface DraggableItemProps {
    handleChangeDisabled: (id: string, e: boolean) => void;
    item: SidebarItem;
    value: string;
}

interface SidebarItem {
    disabled: boolean;
    id: string;
}

export const DraggableItem = ({ handleChangeDisabled, item, value }: DraggableItemProps) => {
    const dragControls = useDragControls();

    return (
        <Reorder.Item
            as="div"
            dragControls={dragControls}
            dragListener={false}
            value={item}
        >
            <Group
                h="3rem"
                noWrap
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}
            >
                <Checkbox
                    checked={!item.disabled}
                    onChange={(e) => handleChangeDisabled(item.id, e.target.checked)}
                />
                <DragHandle dragControls={dragControls} />
                {value}
            </Group>
        </Reorder.Item>
    );
};
