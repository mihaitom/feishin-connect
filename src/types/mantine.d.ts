import { ActionIconSize, PillVariant } from '@mantine/core';

type ExtendedActionIconSize = 'compact-md' | 'compact-sm' | 'compact-xs' | ActionIconSize;
type ExtendedPillVariant = 'outline' | PillVariant;

declare module '@mantine/core' {
    export interface ActionIconProps {
        size?: ExtendedActionIconSize;
    }

    export interface PillProps {
        variant?: ExtendedPillVariant;
    }
}
