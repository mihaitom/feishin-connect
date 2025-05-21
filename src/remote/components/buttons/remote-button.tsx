import { Button, type ButtonProps as MantineButtonProps, Tooltip } from '@mantine/core';
import { forwardRef, MouseEvent, ReactNode, Ref } from 'react';
import styled from 'styled-components';

export interface ButtonProps extends StyledButtonProps {
    tooltip: string;
}

interface StyledButtonProps extends MantineButtonProps {
    $active?: boolean;
    children: ReactNode;
    onClick?: (e: MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    onMouseDown?: (e: MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    ref: Ref<HTMLButtonElement>;
}

const StyledButton = styled(Button)<StyledButtonProps>`
    svg {
        display: flex;
        fill: ${({ $active: active }) =>
            active ? 'var(--primary-color)' : 'var(--playerbar-btn-fg)'};
        stroke: var(--playerbar-btn-fg);
    }

    &:hover {
        background: var(--playerbar-btn-bg-hover);

        svg {
            fill: ${({ $active: active }) =>
                active
                    ? 'var(--primary-color) !important'
                    : 'var(--playerbar-btn-fg-hover) !important'};
        }
    }
`;

export const RemoteButton = forwardRef<HTMLButtonElement, any>(
    ({ children, tooltip, ...props }: any, ref) => {
        return (
            <Tooltip
                label={tooltip}
                withinPortal
            >
                <StyledButton
                    {...props}
                    ref={ref}
                >
                    {children}
                </StyledButton>
            </Tooltip>
        );
    },
);
