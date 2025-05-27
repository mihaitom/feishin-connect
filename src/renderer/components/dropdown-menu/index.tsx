import type {
    MenuDividerProps as MantineMenuDividerProps,
    MenuDropdownProps as MantineMenuDropdownProps,
    MenuItemProps as MantineMenuItemProps,
    MenuLabelProps as MantineMenuLabelProps,
    MenuProps as MantineMenuProps,
} from '@mantine/core';

import { createPolymorphicComponent, Menu as MantineMenu } from '@mantine/core';
import { ReactNode } from 'react';
import { RiArrowLeftSFill } from 'react-icons/ri';
import styled from 'styled-components';

type MenuDividerProps = MantineMenuDividerProps;
type MenuDropdownProps = MantineMenuDropdownProps;
interface MenuItemProps extends MantineMenuItemProps {
    $danger?: boolean;
    $isActive?: boolean;
    children: ReactNode;
}
type MenuLabelProps = MantineMenuLabelProps;
type MenuProps = MantineMenuProps;

const StyledMenu = styled(MantineMenu)<MenuProps>``;

const StyledMenuLabel = styled(MantineMenu.Label)<MenuLabelProps>`
    padding: 0.5rem;
    font-family: var(--content-font-family);
`;

const StyledMenuItem = styled(MantineMenu.Item)<MenuItemProps>`
    position: relative;
    padding: var(--dropdown-menu-item-padding);
    font-family: var(--content-font-family);
    font-size: var(--dropdown-menu-item-font-size);

    cursor: default;

    &:disabled {
        opacity: 0.6;
    }

    &:hover {
        background-color: var(--dropdown-menu-bg-hover);
    }

    & .mantine-Menu-itemLabel {
        margin-right: 2rem;
        margin-left: 1rem;
        color: ${(props) => (props.$danger ? 'var(--danger-color)' : 'var(--dropdown-menu-fg)')};
    }

    & .mantine-Menu-itemRightSection {
        display: flex;
    }
`;

const StyledMenuDropdown = styled(MantineMenu.Dropdown)`
    padding: 0;
    margin: 0;
    background: var(--dropdown-menu-bg);
    filter: drop-shadow(0 0 5px rgb(0 0 0 / 50%));
    border: var(--dropdown-menu-border);
    border-radius: var(--dropdown-menu-border-radius);

    /* *:first-child {
    border-top-left-radius: var(--dropdown-menu-border-radius);
    border-top-right-radius: var(--dropdown-menu-border-radius);
  }

  *:last-child {
    border-bottom-right-radius: var(--dropdown-menu-border-radius);
    border-bottom-left-radius: var(--dropdown-menu-border-radius);
  } */
`;

const StyledMenuDivider = styled(MantineMenu.Divider)`
    padding: 0;
    margin: 0;
`;

export const DropdownMenu = ({ children, ...props }: MenuProps) => {
    return (
        <StyledMenu
            styles={{
                dropdown: {
                    filter: 'drop-shadow(0 0 5px rgb(0, 0, 0, 50%))',
                },
            }}
            transitionProps={{
                transition: 'fade',
            }}
            withinPortal
            {...props}
        >
            {children}
        </StyledMenu>
    );
};

const MenuLabel = ({ children, ...props }: MenuLabelProps) => {
    return <StyledMenuLabel {...props}>{children}</StyledMenuLabel>;
};

const pMenuItem = ({ $danger, $isActive, children, ...props }: MenuItemProps) => {
    return (
        <StyledMenuItem
            $danger={$danger}
            $isActive={$isActive}
            rightSection={$isActive && <RiArrowLeftSFill size={15} />}
            {...props}
        >
            {children}
        </StyledMenuItem>
    );
};

const MenuDropdown = ({ children, ...props }: MenuDropdownProps) => {
    return <StyledMenuDropdown {...props}>{children}</StyledMenuDropdown>;
};

const MenuItem = createPolymorphicComponent<'button', MenuItemProps>(pMenuItem);

const MenuDivider = ({ ...props }: MenuDividerProps) => {
    return <StyledMenuDivider {...props} />;
};

DropdownMenu.Label = MenuLabel;
DropdownMenu.Item = MenuItem;
DropdownMenu.Target = MantineMenu.Target;
DropdownMenu.Dropdown = MenuDropdown;
DropdownMenu.Divider = MenuDivider;
