import clsx from 'clsx';
import {
    ForwardedRef,
    forwardRef,
    HTMLAttributes,
    type ImgHTMLAttributes,
    memo,
    ReactNode,
    useRef,
} from 'react';
import { Img } from 'react-image';

import styles from './image.module.css';

import { AppIcon, Icon } from '/@/shared/components/icon/icon';
import { Skeleton } from '/@/shared/components/skeleton/skeleton';
import { useDebouncedValue } from '/@/shared/hooks/use-debounced-value';
import { useInViewport } from '/@/shared/hooks/use-in-viewport';

export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    containerClassName?: string;
    enableAnimation?: boolean;
    enableDebounce?: boolean;
    enableViewport?: boolean;
    fetchPriority?: 'auto' | 'high' | 'low';
    imageContainerProps?: Omit<ImageContainerProps, 'children'>;
    includeLoader?: boolean;
    includeUnloader?: boolean;
    src: string | string[] | undefined;
    thumbHash?: string;
    unloaderIcon?: keyof typeof AppIcon;
}

interface ImageContainerProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    enableAnimation?: boolean;
}

interface ImageLoaderProps {
    className?: string;
}

interface ImageUnloaderProps {
    className?: string;
    icon?: keyof typeof AppIcon;
}

export const FALLBACK_SVG =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iLjA1IiBkPSJNMCAwaDMwMHYzMDBIMHoiLz48L3N2Zz4=';

export function BaseImage({
    className,
    containerClassName,
    enableAnimation = false,
    enableDebounce = true,
    enableViewport = true,
    fetchPriority,
    imageContainerProps,
    includeLoader = true,
    includeUnloader = true,
    src,
    unloaderIcon = 'emptyImage',
    ...props
}: ImageProps) {
    if (enableDebounce) {
        return (
            <ImageWithDebounce
                className={className}
                containerClassName={containerClassName}
                enableAnimation={enableAnimation}
                enableViewport={enableViewport}
                imageContainerProps={imageContainerProps}
                includeLoader={includeLoader}
                includeUnloader={includeUnloader}
                src={src}
                unloaderIcon={unloaderIcon}
                {...props}
            />
        );
    }

    if (enableViewport) {
        return (
            <ImageWithViewport
                className={className}
                containerClassName={containerClassName}
                enableAnimation={enableAnimation}
                imageContainerProps={imageContainerProps}
                includeLoader={includeLoader}
                includeUnloader={includeUnloader}
                src={src}
                unloaderIcon={unloaderIcon}
                {...props}
            />
        );
    }

    const { className: containerPropsClassName, ...restContainerProps } = imageContainerProps || {};

    return (
        <ImageContainer
            className={clsx(containerClassName, containerPropsClassName)}
            enableAnimation={enableAnimation}
            {...restContainerProps}
        >
            {src ? (
                <Img
                    className={clsx(styles.image, className, {
                        [styles.animated]: enableAnimation,
                    })}
                    decoding="async"
                    fetchPriority={fetchPriority}
                    loader={includeLoader ? <ImageLoader className={className} /> : null}
                    src={src}
                    unloader={
                        includeUnloader ? (
                            <ImageUnloader className={className} icon={unloaderIcon} />
                        ) : null
                    }
                    {...props}
                />
            ) : (
                <ImageUnloader className={className} icon={unloaderIcon} />
            )}
        </ImageContainer>
    );
}

function ImageWithDebounce({
    className,
    containerClassName,
    enableAnimation,
    enableViewport,
    fetchPriority,
    imageContainerProps,
    includeLoader,
    includeUnloader,
    src,
    unloaderIcon,
    ...props
}: ImageProps) {
    const [debouncedSrc] = useDebouncedValue(src, 150, { waitForInitial: true });
    const viewport = useInViewport();
    const { inViewport, ref } = enableViewport ? viewport : { inViewport: true, ref: undefined };
    const { className: containerPropsClassName, ...restContainerProps } = imageContainerProps || {};

    const hasBeenInViewportRef = useRef(false);
    const prevDebouncedSrcRef = useRef(debouncedSrc);

    if (prevDebouncedSrcRef.current !== debouncedSrc) {
        prevDebouncedSrcRef.current = debouncedSrc;
        hasBeenInViewportRef.current = false;
    }

    if (inViewport && debouncedSrc) {
        hasBeenInViewportRef.current = true;
    }

    const shouldShowImage = enableViewport
        ? (inViewport || hasBeenInViewportRef.current) && debouncedSrc
        : debouncedSrc;

    if (enableViewport) {
        return (
            <ImageContainer
                className={clsx(containerClassName, containerPropsClassName)}
                enableAnimation={enableAnimation}
                ref={ref}
                {...restContainerProps}
            >
                {shouldShowImage && debouncedSrc ? (
                    <Img
                        className={clsx(styles.image, className, {
                            [styles.animated]: enableAnimation,
                        })}
                        decoding="async"
                        fetchPriority={fetchPriority}
                        loader={includeLoader ? <ImageLoader className={className} /> : null}
                        src={debouncedSrc}
                        unloader={
                            includeUnloader ? (
                                <ImageUnloader className={className} icon={unloaderIcon} />
                            ) : null
                        }
                        {...props}
                    />
                ) : !src ? (
                    <ImageUnloader className={className} icon={unloaderIcon} />
                ) : (
                    <ImageLoader className={className} />
                )}
            </ImageContainer>
        );
    }

    return (
        <ImageContainer
            className={clsx(containerClassName, containerPropsClassName)}
            enableAnimation={enableAnimation}
            {...restContainerProps}
        >
            {debouncedSrc ? (
                <Img
                    className={clsx(styles.image, className, {
                        [styles.animated]: enableAnimation,
                    })}
                    decoding="async"
                    fetchPriority={fetchPriority}
                    loader={includeLoader ? <ImageLoader className={className} /> : null}
                    src={debouncedSrc}
                    unloader={
                        includeUnloader ? (
                            <ImageUnloader className={className} icon={unloaderIcon} />
                        ) : null
                    }
                    {...props}
                />
            ) : !src ? (
                <ImageUnloader className={className} icon={unloaderIcon} />
            ) : (
                <ImageLoader className={className} />
            )}
        </ImageContainer>
    );
}

function ImageWithViewport({
    className,
    containerClassName,
    enableAnimation,
    fetchPriority,
    imageContainerProps,
    includeLoader,
    includeUnloader,
    src,
    unloaderIcon,
    ...props
}: ImageProps) {
    const { inViewport, ref } = useInViewport();
    const { className: containerPropsClassName, ...restContainerProps } = imageContainerProps || {};

    const hasBeenInViewportRef = useRef(false);
    const prevSrcRef = useRef(src);

    if (prevSrcRef.current !== src) {
        prevSrcRef.current = src;
        hasBeenInViewportRef.current = false;
    }

    if (inViewport && src) {
        hasBeenInViewportRef.current = true;
    }

    const shouldShowImage = (inViewport || hasBeenInViewportRef.current) && src;

    return (
        <ImageContainer
            className={clsx(containerClassName, containerPropsClassName)}
            enableAnimation={enableAnimation}
            ref={ref}
            {...restContainerProps}
        >
            {shouldShowImage ? (
                <Img
                    className={clsx(styles.image, className, {
                        [styles.animated]: enableAnimation,
                    })}
                    decoding="async"
                    fetchPriority={fetchPriority}
                    loader={includeLoader ? <ImageLoader className={className} /> : null}
                    src={src}
                    unloader={
                        includeUnloader ? (
                            <ImageUnloader className={className} icon={unloaderIcon} />
                        ) : null
                    }
                    {...props}
                />
            ) : !src ? (
                <ImageUnloader className={className} icon={unloaderIcon} />
            ) : (
                <ImageLoader className={className} />
            )}
        </ImageContainer>
    );
}

export const Image = memo(BaseImage);

const ImageContainer = forwardRef(
    (
        { children, className, enableAnimation, ...props }: ImageContainerProps,
        ref: ForwardedRef<HTMLDivElement>,
    ) => {
        if (!enableAnimation) {
            return (
                <div className={clsx(styles.imageContainer, className)} ref={ref} {...props}>
                    {children}
                </div>
            );
        }

        return (
            <div className={clsx(styles.imageContainer, className)} ref={ref} {...props}>
                {children}
            </div>
        );
    },
);

export function ImageLoader({ className }: ImageLoaderProps) {
    return (
        <Skeleton
            className={clsx(styles.skeleton, styles.loader, className)}
            containerClassName={styles.skeletonContainer}
        />
    );
}

export function ImageUnloader({ className, icon = 'emptyImage' }: ImageUnloaderProps) {
    return (
        <div className={clsx(styles.unloader, className)}>
            <Icon color="default" icon={icon} size="25%" />
        </div>
    );
}
