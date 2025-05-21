import { ButtonProps } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { RiSortAsc, RiSortDesc } from 'react-icons/ri';

import { Button, Tooltip } from '/@/renderer/components';
import { SortOrder } from '/@/shared/types/domain-types';

interface OrderToggleButtonProps {
    buttonProps?: Partial<ButtonProps>;
    onToggle: () => void;
    sortOrder: SortOrder;
}

export const OrderToggleButton = ({ buttonProps, onToggle, sortOrder }: OrderToggleButtonProps) => {
    const { t } = useTranslation();
    return (
        <Tooltip
            label={
                sortOrder === SortOrder.ASC
                    ? t('common.ascending', { postProcess: 'sentenceCase' })
                    : t('common.descending', { postProcess: 'sentenceCase' })
            }
        >
            <Button
                compact
                fw="600"
                onClick={onToggle}
                size="md"
                variant="subtle"
                {...buttonProps}
            >
                <>
                    {sortOrder === SortOrder.ASC ? (
                        <RiSortAsc size="1.3rem" />
                    ) : (
                        <RiSortDesc size="1.3rem" />
                    )}
                </>
            </Button>
        </Tooltip>
    );
};
