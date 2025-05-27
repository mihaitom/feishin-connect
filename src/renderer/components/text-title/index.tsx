import type { TitleProps as MantineTitleProps } from '@mantine/core';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { createPolymorphicComponent, Title as MantineHeader } from '@mantine/core';
import styled from 'styled-components';

import { textEllipsis } from '/@/renderer/styles';

type MantineTextTitleDivProps = ComponentPropsWithoutRef<'div'> & MantineTitleProps;

interface TextTitleProps extends MantineTextTitleDivProps {
    $link?: boolean;
    $noSelect?: boolean;
    $secondary?: boolean;
    children?: ReactNode;
    overflow?: 'hidden' | 'visible';
    to?: string;
    weight?: number;
}

const StyledTextTitle = styled(MantineHeader)<TextTitleProps>`
    overflow: ${(props) => props.overflow};
    color: ${(props) => (props.$secondary ? 'var(--main-fg-secondary)' : 'var(--main-fg)')};
    cursor: ${(props) => props.$link && 'cursor'};
    user-select: ${(props) => (props.$noSelect ? 'none' : 'auto')};
    transition: color 0.2s ease-in-out;
    ${(props) => props.overflow === 'hidden' && !props.lineClamp && textEllipsis}

    &:hover {
        color: ${(props) => props.$link && 'var(--main-fg)'};
        text-decoration: ${(props) => (props.$link ? 'underline' : 'none')};
    }
`;

const _TextTitle = ({ $noSelect, $secondary, children, overflow, ...rest }: TextTitleProps) => {
    return (
        <StyledTextTitle
            $noSelect={$noSelect}
            $secondary={$secondary}
            overflow={overflow}
            {...rest}
        >
            {children}
        </StyledTextTitle>
    );
};

export const TextTitle = createPolymorphicComponent<'div', TextTitleProps>(_TextTitle);
