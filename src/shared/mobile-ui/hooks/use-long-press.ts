import { useCallback, useRef } from 'react';

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

    const clear = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const onPointerDown = useCallback(
        (event: React.PointerEvent) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;

            firedRef.current = false;
            startPosRef.current = { x: event.clientX, y: event.clientY };
            clear();
            // `user-select: none` (remote-reset.css) should already stop this,
            // but some Android WebViews still start a native text-selection
            // gesture on a hold regardless — wipe it so nothing lingers
            // highlighted once the sheet opens.
            window.getSelection()?.removeAllRanges();

            timerRef.current = window.setTimeout(() => {
                firedRef.current = true;
                window.getSelection()?.removeAllRanges();
                navigator.vibrate?.(10);
                onLongPress();
            }, delay);
        },
        [clear, delay, onLongPress],
    );

    const onPointerMove = useCallback(
        (event: React.PointerEvent) => {
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
