import { Image } from '@mantine/core';
import { ReactNode, useEffect, useState } from 'react';

import { Flex } from '/@/shared/components/flex/flex';

interface ThumbnailProps {
    fallbackIcon?: ReactNode;
    onError?: () => void;
    size?: number;
    src: null | string;
}

export const Thumbnail = ({ fallbackIcon, onError, size = 48, src }: ThumbnailProps) => {
    // Falls back to `fallbackIcon` on a load error, not just a missing `src`
    // — previously a broken image (unreachable server, no `remoteUrl`
    // configured) rendered the browser's raw broken-image glyph on every
    // list row (tracks/albums/playlists/queue) with no graceful fallback,
    // unlike the desktop app's own image components. `onError` stays
    // available for callers that want to react further (e.g.
    // remote-container.tsx retrying via the 'proxy' WS relay) — this doesn't
    // replace that, it just guarantees every caller gets a sane default even
    // if they don't wire anything up themselves.
    const [hasError, setHasError] = useState(false);

    // A new `src` deserves a fresh attempt — without this, once one item
    // shown through a given instance fails, a later item reusing it (e.g. a
    // recycled virtualized row, or the player thumbnail switching songs)
    // would stay stuck on the fallback even though its own image is fine.
    useEffect(() => {
        setHasError(false);
    }, [src]);

    if (!src || hasError) {
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
            onError={() => {
                setHasError(true);
                onError?.();
            }}
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
