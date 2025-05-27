import type {
    PopoverDropdownProps as MantinePopoverDropdownProps,
    PopoverProps as MantinePopoverProps,
} from '@mantine/core';

import { Popover as MantinePopover } from '@mantine/core';
import styled from 'styled-components';

type PopoverDropdownProps = MantinePopoverDropdownProps;
type PopoverProps = MantinePopoverProps;

const StyledPopover = styled(MantinePopover)``;

const StyledDropdown = styled(MantinePopover.Dropdown)<PopoverDropdownProps>`
    padding: 0.5rem;
    font-family: var(--content-font-family);
    font-size: 0.9em;
    background-color: var(--dropdown-menu-bg);
    border: var(--dropdown-menu-border);
`;

export const Popover = ({ children, ...props }: PopoverProps) => {
    return (
        <StyledPopover
            styles={{
                dropdown: {
                    filter: 'drop-shadow(0 0 5px rgb(0, 0, 0, 50%))',
                },
            }}
            transitionProps={{ transition: 'fade' }}
            withinPortal
            {...props}
        >
            {children}
        </StyledPopover>
    );
};

Popover.Target = MantinePopover.Target;
Popover.Dropdown = StyledDropdown;
