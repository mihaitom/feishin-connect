import clsx from 'clsx';
import { motion } from 'motion/react';
import { memo, MouseEvent, useMemo } from 'react';

import styles from './item-card-controls.module.css';

import { ItemListStateActions } from '/@/renderer/components/item-list/helpers/item-list-state';
import { ItemControls } from '/@/renderer/components/item-list/types';
import { useIsPlayerFetching } from '/@/renderer/features/player/context/player-context';
import { useIsMutatingCreateFavorite } from '/@/renderer/features/shared/mutations/create-favorite-mutation';
import { useIsMutatingDeleteFavorite } from '/@/renderer/features/shared/mutations/delete-favorite-mutation';
import { useIsMutatingRating } from '/@/renderer/features/shared/mutations/set-rating-mutation';
import { animationVariants } from '/@/shared/components/animations/animation-variants';
import { AppIcon, Icon, IconProps } from '/@/shared/components/icon/icon';
import { Rating } from '/@/shared/components/rating/rating';
import { useLongPress } from '/@/shared/hooks/use-long-press';
import {
    Album,
    AlbumArtist,
    Artist,
    LibraryItem,
    Playlist,
    Song,
} from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

interface ItemCardControlsProps {
    controls?: ItemControls;
    enableExpansion?: boolean;
    internalState?: ItemListStateActions;
    item: Album | AlbumArtist | Artist | Playlist | Song | undefined;
    itemType: LibraryItem;
    type?: 'compact' | 'default' | 'poster';
}

const containerProps = {
    compact: {
        animate: 'show',
        exit: 'hidden',
        initial: 'hidden',
        variants: animationVariants.combine(animationVariants.zoomIn, animationVariants.fadeIn),
    },
    default: {
        animate: 'show',
        exit: 'hidden',
        initial: 'hidden',
        variants: animationVariants.combine(animationVariants.zoomIn, animationVariants.fadeIn),
    },
    poster: {
        animate: 'show',
        exit: 'hidden',
        initial: 'hidden',
        variants: animationVariants.combine(animationVariants.slideInUp, animationVariants.fadeIn),
    },
};

const createPlayHandler =
    (
        controls: ItemControls | undefined,
        item: Album | AlbumArtist | Artist | Playlist | Song | undefined,
        internalState: ItemListStateActions | undefined,
        itemType: LibraryItem,
        playType: Play,
    ) =>
    (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();

        if (!item) {
            return;
        }

        controls?.onPlay?.({
            event: e,
            internalState,
            item,
            itemType,
            playType,
        });
    };

const createFavoriteHandler =
    (
        controls: ItemControls | undefined,
        item: Album | AlbumArtist | Artist | Playlist | Song | undefined,
        internalState: ItemListStateActions | undefined,
        itemType: LibraryItem,
    ) =>
    (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();

        if (!item) {
            return;
        }

        const newFavorite = !(item as { userFavorite: boolean }).userFavorite;
        controls?.onFavorite?.({
            event: e,
            favorite: newFavorite,
            internalState,
            item,
            itemType,
        });
    };

const createRatingChangeHandler =
    (
        controls: ItemControls | undefined,
        item: Album | AlbumArtist | Artist | Playlist | Song | undefined,
        internalState: ItemListStateActions | undefined,
        itemType: LibraryItem,
    ) =>
    (rating: number) => {
        if (!item) {
            return;
        }

        let newRating = rating;

        if (rating === (item as { userRating: number }).userRating) {
            newRating = 0;
        }

        controls?.onRating?.({
            event: null,
            internalState,
            item,
            itemType,
            rating: newRating,
        });
    };

const moreDoubleClickHandler = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
};

const createMoreHandler =
    (
        controls: ItemControls | undefined,
        item: Album | AlbumArtist | Artist | Playlist | Song | undefined,
        internalState: ItemListStateActions | undefined,
        itemType: LibraryItem,
    ) =>
    (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();
        controls?.onMore?.({
            event: e,
            internalState,
            item,
            itemType,
        });
    };

const createExpandHandler =
    (
        controls: ItemControls | undefined,
        item: Album | AlbumArtist | Artist | Playlist | Song | undefined,
        internalState: ItemListStateActions | undefined,
        itemType: LibraryItem,
    ) =>
    (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();
        controls?.onExpand?.({
            event: e,
            internalState,
            item,
            itemType,
        });
    };

export const ItemCardControls = ({
    controls,
    enableExpansion,
    internalState,
    item,
    itemType,
    type = 'default',
}: ItemCardControlsProps) => {
    const playNowHandler = useMemo(
        () => createPlayHandler(controls, item, internalState, itemType, Play.NOW),
        [controls, item, internalState, itemType],
    );

    const playNextHandler = useMemo(
        () => createPlayHandler(controls, item, internalState, itemType, Play.NEXT),
        [controls, item, internalState, itemType],
    );

    const playLastHandler = useMemo(
        () => createPlayHandler(controls, item, internalState, itemType, Play.LAST),
        [controls, item, internalState, itemType],
    );

    const playShuffleHandler = useMemo(
        () => createPlayHandler(controls, item, internalState, itemType, Play.SHUFFLE),
        [controls, item, internalState, itemType],
    );

    const playNextShuffleHandler = useMemo(
        () => createPlayHandler(controls, item, internalState, itemType, Play.NEXT_SHUFFLE),
        [controls, item, internalState, itemType],
    );

    const playLastShuffleHandler = useMemo(
        () => createPlayHandler(controls, item, internalState, itemType, Play.LAST_SHUFFLE),
        [controls, item, internalState, itemType],
    );

    const favoriteHandler = useMemo(
        () => createFavoriteHandler(controls, item, internalState, itemType),
        [controls, item, internalState, itemType],
    );

    const ratingChangeHandler = useMemo(
        () => createRatingChangeHandler(controls, item, internalState, itemType),
        [controls, item, internalState, itemType],
    );

    const moreHandler = useMemo(
        () => createMoreHandler(controls, item, internalState, itemType),
        [controls, item, internalState, itemType],
    );

    const expandHandler = useMemo(
        () => createExpandHandler(controls, item, internalState, itemType),
        [controls, item, internalState, itemType],
    );

    const isFavorite = (item as { userFavorite?: boolean })?.userFavorite ?? false;

    return (
        <motion.div className={clsx(styles.container)} {...containerProps[type]}>
            {controls?.onPlay && (
                <>
                    <PlayButton onClick={playNowHandler} onLongPress={playShuffleHandler} />
                    <SecondaryPlayButton
                        className={styles.left}
                        icon="mediaPlayNext"
                        onClick={playNextHandler}
                        onLongPress={playNextShuffleHandler}
                    />
                    <SecondaryPlayButton
                        className={styles.right}
                        icon="mediaPlayLast"
                        onClick={playLastHandler}
                        onLongPress={playLastShuffleHandler}
                    />
                </>
            )}
            {controls?.onFavorite && (
                <FavoriteButton isFavorite={isFavorite} onClick={favoriteHandler} />
            )}
            {controls?.onRating && (
                <RatingButton
                    onChange={ratingChangeHandler}
                    rating={(item as { userRating: number }).userRating}
                />
            )}
            {controls?.onMore && (
                <SecondaryButton
                    className={styles.options}
                    icon="ellipsisHorizontal"
                    onClick={moreHandler}
                    onDoubleClick={moreDoubleClickHandler}
                />
            )}
            {controls?.onExpand && enableExpansion && (
                <SecondaryButton
                    className={styles.expand}
                    icon="arrowDownS"
                    onClick={expandHandler}
                />
            )}
        </motion.div>
    );
};

const FavoriteButton = memo(
    ({
        isFavorite,
        onClick,
    }: {
        isFavorite: boolean;
        onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
    }) => {
        const isMutatingCreate = useIsMutatingCreateFavorite();
        const isMutatingDelete = useIsMutatingDeleteFavorite();
        const isMutating = isMutatingCreate || isMutatingDelete;

        const favoriteIconProps = useMemo<Partial<IconProps>>(
            () => ({
                color: isFavorite ? ('primary' as const) : ('default' as const),
                fill: isFavorite ? ('primary' as const) : undefined,
            }),
            [isFavorite],
        );

        return (
            <SecondaryButton
                className={styles.favorite}
                disabled={isMutating}
                icon="favorite"
                iconProps={favoriteIconProps}
                onClick={onClick}
            />
        );
    },
    (prev, next) => prev.isFavorite === next.isFavorite,
);

const RatingButton = memo(
    ({ onChange, rating }: { onChange: (rating: number) => void; rating: number }) => {
        const ratingClickHandler = (e: MouseEvent<HTMLElement>) => {
            e.stopPropagation();
            e.preventDefault();
        };

        const ratingMouseDownHandler = (e: React.MouseEvent<HTMLElement>) => {
            e.stopPropagation();
            e.preventDefault();
        };

        const isMutatingRating = useIsMutatingRating();
        return (
            <Rating
                className={styles.rating}
                onChange={onChange}
                onClick={ratingClickHandler}
                onMouseDown={ratingMouseDownHandler}
                readOnly={isMutatingRating}
                size="sm"
                value={rating}
            />
        );
    },
    (prev, next) => prev.rating === next.rating,
);

const PlayButton = memo(
    ({
        loading,
        onClick,
        onLongPress,
    }: {
        loading?: boolean;
        onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
        onLongPress?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    }) => {
        const isPlayerFetching = useIsPlayerFetching();

        const disabled = isPlayerFetching || loading;

        const longPressHandlers = useLongPress<HTMLButtonElement>({
            onClick: (e) => {
                if (disabled || loading) {
                    return;
                }
                e.stopPropagation();
                e.preventDefault();
                onClick?.(e as React.MouseEvent<HTMLButtonElement>);
            },
            onLongPress: (e) => {
                if (disabled || loading) {
                    return;
                }
                e.stopPropagation();
                e.preventDefault();
                onLongPress?.(e as React.MouseEvent<HTMLButtonElement>);
            },
        });

        const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            longPressHandlers.onMouseDown?.(e);
        };

        return (
            <button
                className={clsx(styles.playButton, styles.primary, {
                    [styles.disabled]: disabled,
                })}
                disabled={disabled}
                onMouseDown={handleMouseDown}
                onMouseLeave={longPressHandlers.onMouseLeave}
                onMouseUp={longPressHandlers.onMouseUp}
                onTouchCancel={longPressHandlers.onTouchCancel}
                onTouchEnd={longPressHandlers.onTouchEnd}
                onTouchStart={longPressHandlers.onTouchStart}
            >
                <Icon icon="mediaPlay" size="lg" />
            </button>
        );
    },
);

const SecondaryPlayButton = memo(
    ({
        className,
        icon,
        onClick,
        onLongPress,
    }: {
        className?: string;
        icon: keyof typeof AppIcon;
        onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
        onLongPress?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    }) => {
        const isPlayerFetching = useIsPlayerFetching();

        const disabled = isPlayerFetching;

        const longPressHandlers = useLongPress<HTMLButtonElement>({
            onClick: (e) => {
                e.stopPropagation();
                e.preventDefault();
                onClick?.(e as React.MouseEvent<HTMLButtonElement>);
            },
            onLongPress: (e) => {
                e.stopPropagation();
                e.preventDefault();
                onLongPress?.(e as React.MouseEvent<HTMLButtonElement>);
            },
        });

        const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            longPressHandlers.onMouseDown?.(e);
        };

        return (
            <button
                className={clsx(styles.playButton, styles.secondary, className, {
                    [styles.disabled]: disabled,
                })}
                disabled={disabled}
                onMouseDown={handleMouseDown}
                onMouseLeave={longPressHandlers.onMouseLeave}
                onMouseUp={longPressHandlers.onMouseUp}
                onTouchCancel={longPressHandlers.onTouchCancel}
                onTouchEnd={longPressHandlers.onTouchEnd}
                onTouchStart={longPressHandlers.onTouchStart}
            >
                <Icon icon={icon} size="lg" />
            </button>
        );
    },
);

interface SecondaryButtonProps {
    className?: string;
    disabled?: boolean;
    icon: keyof typeof AppIcon;
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

const SecondaryButton = memo(
    ({
        className,
        disabled,
        icon,
        iconProps,
        onClick,
        onDoubleClick,
    }: SecondaryButtonProps & {
        iconProps?: Partial<IconProps>;
        onDoubleClick?: (e: MouseEvent<HTMLButtonElement>) => void;
    }) => {
        const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            e.preventDefault();
            onClick?.(e);
        };

        const handleDoubleClick = (e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            e.preventDefault();
            onDoubleClick?.(e);
        };

        const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            e.preventDefault();
        };

        return (
            <button
                className={clsx(styles.secondaryButton, className)}
                disabled={disabled}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onMouseDown={handleMouseDown}
            >
                <Icon icon={icon} size="lg" {...iconProps} />
            </button>
        );
    },
);
