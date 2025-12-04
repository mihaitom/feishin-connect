import type { Variants } from 'motion/react';
import type { ReactNode } from 'react';

import { AnimatePresence, motion, useMotionValue } from 'motion/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import styles from './grid-carousel.module.css';

import { useContainerQuery } from '/@/renderer/hooks';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Group } from '/@/shared/components/group/group';
import { TextTitle } from '/@/shared/components/text-title/text-title';

interface Card {
    content: ReactNode;
    id: string;
}

interface GridCarouselProps {
    cards: Card[];
    hasNextPage?: boolean;
    loadNextPage?: () => void;
    onNextPage: (page: number) => void;
    onPrevPage: (page: number) => void;
    rowCount?: number;
    title?: ReactNode | string;
}

const MemoizedCard = memo(({ content }: { content: ReactNode }) => (
    <div className={styles.card}>{content}</div>
));

MemoizedCard.displayName = 'MemoizedCard';

const pageVariants: Variants = {
    animate: { opacity: 1, transition: { duration: 0.3, ease: 'easeOut' }, x: 0 },
    exit: (custom: { isNext: boolean }) => ({
        opacity: 0,
        transition: { duration: 0.3, ease: 'easeIn' },
        x: custom.isNext ? -100 : 100,
    }),
    initial: (custom: { isNext: boolean }) => ({ opacity: 0, x: custom.isNext ? 100 : -100 }),
};

function BaseGridCarousel(props: GridCarouselProps) {
    const { cards, hasNextPage, loadNextPage, onNextPage, onPrevPage, rowCount = 1, title } = props;
    const { ref, ...cq } = useContainerQuery({
        '2xl': 1280,
        '3xl': 1440,
        lg: 960,
        md: 720,
        sm: 520,
        xl: 1152,
        xs: 360,
    });

    const [currentPage, setCurrentPage] = useState({
        isNext: false,
        page: 0,
    });

    const handlePrevPage = useCallback(() => {
        setCurrentPage((prev) => ({
            isNext: false,
            page: prev.page > 0 ? prev.page - 1 : 0,
        }));
        onPrevPage(currentPage.page);
    }, [currentPage, onPrevPage]);

    const handleNextPage = useCallback(() => {
        setCurrentPage((prev) => ({
            isNext: true,
            page: prev.page + 1,
        }));
        onNextPage(currentPage.page);
    }, [currentPage, onNextPage]);

    const cardsToShow = getCardsToShow({
        isLargerThan2xl: cq.is2xl,
        isLargerThan3xl: cq.is3xl,
        isLargerThanLg: cq.isLg,
        isLargerThanMd: cq.isMd,
        isLargerThanSm: cq.isSm,
        isLargerThanXl: cq.isXl,
    });

    const visibleCards = useMemo(() => {
        return cards.slice(
            currentPage.page * cardsToShow * rowCount,
            (currentPage.page + 1) * cardsToShow * rowCount,
        );
    }, [cards, currentPage, cardsToShow, rowCount]);

    const shouldLoadNextPage = visibleCards.length < cardsToShow * rowCount;

    useEffect(() => {
        if (shouldLoadNextPage) {
            loadNextPage?.();
        }
    }, [loadNextPage, shouldLoadNextPage]);

    const isPrevDisabled = currentPage.page === 0;
    const hasMoreCards = (currentPage.page + 1) * cardsToShow * rowCount < cards.length;
    const isNextDisabled = !hasMoreCards && (hasNextPage === false || hasNextPage === undefined);

    const indicatorRef = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const dragThreshold = 1;

    const handleDragEnd = useCallback(() => {
        const dragDistance = x.get();

        if (Math.abs(dragDistance) > dragThreshold) {
            if (dragDistance > 0 && !isPrevDisabled) {
                // Dragged right, go to previous page
                handlePrevPage();
            } else if (dragDistance < 0 && !isNextDisabled) {
                // Dragged left, go to next page
                handleNextPage();
            }
        }

        x.set(0);
    }, [handleNextPage, handlePrevPage, isNextDisabled, isPrevDisabled, x]);

    return (
        <div className={styles.gridCarousel} ref={ref}>
            {cq.isCalculated && (
                <>
                    <div className={styles.navigation}>
                        {typeof title === 'string' ? (
                            <TextTitle fw={700} isNoSelect order={3}>
                                {title}
                            </TextTitle>
                        ) : (
                            title
                        )}
                        <Group gap="xs" justify="end">
                            <ActionIcon
                                disabled={isPrevDisabled}
                                icon="arrowLeftS"
                                iconProps={{ size: 'lg' }}
                                onClick={handlePrevPage}
                                size="xs"
                                variant="subtle"
                            />
                            <ActionIcon
                                disabled={isNextDisabled}
                                icon="arrowRightS"
                                iconProps={{ size: 'lg' }}
                                onClick={handleNextPage}
                                size="xs"
                                variant="subtle"
                            />
                        </Group>
                    </div>
                    <AnimatePresence custom={currentPage} initial={false} mode="wait">
                        <motion.div
                            animate="animate"
                            className={styles.grid}
                            custom={currentPage}
                            exit="exit"
                            initial="initial"
                            key={currentPage.page}
                            style={
                                {
                                    '--cards-to-show': cardsToShow,
                                    '--row-count': rowCount,
                                } as React.CSSProperties
                            }
                            variants={pageVariants}
                        >
                            {visibleCards.map((card) => (
                                <MemoizedCard content={card.content} key={card.id} />
                            ))}
                        </motion.div>
                    </AnimatePresence>
                    <motion.div
                        className={styles.pageIndicator}
                        drag="x"
                        dragConstraints={{ left: -20, right: 20 }}
                        dragElastic={0.3}
                        dragSnapToOrigin={true}
                        onDragEnd={handleDragEnd}
                        ref={indicatorRef}
                        style={{ x }}
                    >
                        <motion.div className={styles.indicatorTrack} />
                    </motion.div>
                </>
            )}
        </div>
    );
}

export const GridCarousel = memo(BaseGridCarousel);

GridCarousel.displayName = 'GridCarousel';

function getCardsToShow(breakpoints: {
    isLargerThan2xl: boolean;
    isLargerThan3xl: boolean;
    isLargerThanLg: boolean;
    isLargerThanMd: boolean;
    isLargerThanSm: boolean;
    isLargerThanXl: boolean;
}) {
    if (breakpoints.isLargerThan3xl) {
        return 8;
    }

    if (breakpoints.isLargerThan2xl) {
        return 7;
    }

    if (breakpoints.isLargerThanXl) {
        return 6;
    }

    if (breakpoints.isLargerThanLg) {
        return 5;
    }

    if (breakpoints.isLargerThanMd) {
        return 4;
    }

    if (breakpoints.isLargerThanSm) {
        return 3;
    }

    return 2;
}
