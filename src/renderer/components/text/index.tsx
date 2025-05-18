import type { Font } from '/@/renderer/styles';
import type { TextProps as MantineTextProps } from '@mantine/core';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { createPolymorphicComponent, Text as MantineText } from '@mantine/core';
import styled from 'styled-components';

import { textEllipsis } from '/@/renderer/styles';

type MantineTextDivProps = ComponentPropsWithoutRef<'div'> & MantineTextProps;

interface TextProps extends MantineTextDivProps {
    $link?: boolean;
    $noSelect?: boolean;
    $secondary?: boolean;
    children?: ReactNode;
    font?: Font;
    overflow?: 'hidden' | 'visible';
    to?: string;
    weight?: number;
}

const StyledText = styled(MantineText)<TextProps>`
    overflow: ${(props) => props.overflow};
    font-family: ${(props) => props.font};
    color: ${(props) => (props.$secondary ? 'var(--main-fg-secondary)' : 'var(--main-fg)')};
    cursor: ${(props) => props.$link && 'cursor'};
    user-select: ${(props) => (props.$noSelect ? 'none' : 'auto')};
    ${(props) => props.overflow === 'hidden' && !props.lineClamp && textEllipsis}

    &:hover {
        color: ${(props) => props.$link && 'var(--main-fg)'};
        text-decoration: ${(props) => (props.$link ? 'underline' : 'none')};
    }
`;

export const _Text = ({ $noSelect, $secondary, children, font, overflow, ...rest }: TextProps) => {
    return (
        <StyledText
            $noSelect={$noSelect}
            $secondary={$secondary}
            font={font}
            overflow={overflow}
            {...rest}
        >
            {children}
        </StyledText>
    );
};

export const Text = createPolymorphicComponent<'div', TextProps>(_Text);

_Text.defaultProps = {
    $link: false,
    $noSelect: false,
    $secondary: false,
    font: undefined,
    overflow: 'visible',
    to: '',
    weight: 400,
};
