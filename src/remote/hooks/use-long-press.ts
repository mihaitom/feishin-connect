import { useCallback, useEffect, useRef } from 'react';

interface UseLongPressHandlers {
    onClick: (event: React.MouseEvent) => void;
    onContextMenu: (event: React.MouseEvent) => void;
    onPointerCancel: () => void;
    onPointerDown: (event: React.PointerEvent) => void;
    onPointerMove: (event: React.PointerEvent) => void;
    onPointerUp: () => void;
}

interface UseLongPressOptions {
    delay?: number;
    moveThreshold?: number;
    onClick?: () => void;
    onLongPress: () => void;
}

// Long-press via pointer events rather than the native `contextmenu` event —
// iOS Safari doesn't reliably fire `contextmenu` on a touch-and-hold over an
// arbitrary element, only Android/desktop do.
export function useLongPress({
    delay = 450,
    moveThreshold = 10,
    onClick,
    onLongPress,
}: UseLongPressOptions): UseLongPressHandlers {
    const timerRef = useRef<null | number>(null);
    const firedRef = useRef(false);
    const startPosRef = useRef<null | { x: number; y: number }>(null);

    // `user-select: none` (remote-reset.css) should already stop this, but
    // some mobile browsers/WebViews run their own native long-press-to-select
    // gesture on an independent timer, not tied to CSS at all — clearing the
    // selection only at pointerdown and once our own timer fires leaves a gap
    // where the native gesture can still win (its threshold doesn't have to
    // match ours) and leave text highlighted after the sheet opens. Watching
    // `selectionchange` for the whole gesture closes that gap: any selection
    // the browser creates while a press is in flight gets wiped immediately,
    // regardless of which timer produced it.
    const handleSelectionChange = useCallback(() => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            selection.removeAllRanges();
        }
    }, []);

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Stops the whole gesture: cancels a pending timer and, since there's no
    // longer a press to protect, stops watching for stray selections too.
    const clear = useCallback(() => {
        clearTimer();
        document.removeEventListener('selectionchange', handleSelectionChange);
    }, [clearTimer, handleSelectionChange]);

    useEffect(() => clear, [clear]);

    const onPointerDown = useCallback(
        (event: React.PointerEvent) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;

            firedRef.current = false;
            startPosRef.current = { x: event.clientX, y: event.clientY };
            clear();
            window.getSelection()?.removeAllRanges();
            document.addEventListener('selectionchange', handleSelectionChange);

            timerRef.current = window.setTimeout(() => {
                firedRef.current = true;
                // Keep watching selectionchange until the finger actually
                // lifts (onPointerUp/onPointerCancel) — the native gesture
                // that raced us here can still land a selection after our
                // timer fired but before the user releases.
                clearTimer();
                navigator.vibrate?.(10);
                onLongPress();
            }, delay);
        },
        [clear, clearTimer, delay, handleSelectionChange, onLongPress],
    );

    const onPointerMove = useCallback(
        (event: React.PointerEvent) => {
            // Once the long-press has fired, movement must not cancel the
            // gesture anymore — in particular it must not tear down the
            // selectionchange watch above, which is relied on to keep
            // clearing stray selections until the finger actually lifts.
            if (firedRef.current) return;

            const start = startPosRef.current;
            if (!start) return;

            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;

            if (Math.hypot(dx, dy) > moveThreshold) {
                clear();
            }
        },
        [clear, moveThreshold],
    );

    const onPointerUp = useCallback(() => {
        clear();
    }, [clear]);

    const onClickHandler = useCallback(
        (event: React.MouseEvent) => {
            if (firedRef.current) {
                event.preventDefault();
                event.stopPropagation();
                firedRef.current = false;
                return;
            }

            onClick?.();
        },
        [onClick],
    );

    const onContextMenu = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
    }, []);

    return {
        onClick: onClickHandler,
        onContextMenu,
        onPointerCancel: onPointerUp,
        onPointerDown,
        onPointerMove,
        onPointerUp,
    };
}
