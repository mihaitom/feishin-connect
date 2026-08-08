import { Image } from '@mantine/core';
import { ReactNode } from 'react';

import { Flex } from '/@/shared/components/flex/flex';

interface ThumbnailProps {
    fallbackIcon?: ReactNode;
    size?: number;
    src: null | string;
}

export const Thumbnail = ({ fallbackIcon, size = 48, src }: ThumbnailProps) => {
    if (!src) {
        return (
            <Flex
                align="center"
                justify="center"
                style={{
                    background: 'var(--theme-colors-surface)',
                    borderRadius: 8,
                    color: 'var(--theme-colors-text-secondary)',
                    flexShrink: 0,
                    height: size,
                    width: size,
                }}
            >
                {fallbackIcon}
            </Flex>
        );
    }

    return (
        <Image
            fit="cover"
            radius={8}
            src={src}
            // Mantine's Image defaults to width:100% via its own stylesheet,
            // which beats the bare width/height props (those only set the
            // native <img> attribute, near-zero CSS specificity) — without
            // this the thumbnail stretched to fill the whole row. Setting
            // size here, as an inline style, wins reliably.
            style={{ flexShrink: 0, height: size, width: size }}
        />
    );
};
