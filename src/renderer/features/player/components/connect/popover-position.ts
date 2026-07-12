// Width the popover renders at — must match connect-popover.tsx's own
// `width: min(350px, calc(100vw - 24px))` style.
export const POPOVER_WIDTH = 350;
export const POPOVER_MARGIN = 12;

export interface PopoverPosition {
    bottom: number;
    right: number;
}

/**
 * Positions the Connect popover above its trigger button, clamped so it
 * stays fully on-screen horizontally. The -120 offset is tuned for desktop,
 * where the cast button sits among other right-side playerbar icons — on
 * narrow (mobile) viewports it can push the popover partly or fully off the
 * left/right edge, so the result is clamped back into view.
 */
export const computePopoverPosition = (
    buttonRect: { right: number; top: number },
    viewport: { height: number; width: number },
): PopoverPosition => {
    const popoverWidth = Math.min(POPOVER_WIDTH, viewport.width - POPOVER_MARGIN * 2);
    const desiredRight = viewport.width - buttonRect.right - 120;
    const right = Math.min(
        Math.max(desiredRight, POPOVER_MARGIN),
        viewport.width - popoverWidth - POPOVER_MARGIN,
    );

    return {
        bottom: viewport.height - buttonRect.top + 40,
        right,
    };
};
