import { describe, expect, it } from 'vitest';

import { computePopoverPosition, POPOVER_MARGIN, POPOVER_WIDTH } from '../popover-position';

describe('computePopoverPosition', () => {
    it('bottom sits 40px above the button, offset for viewport height', () => {
        const { bottom } = computePopoverPosition(
            { right: 1200, top: 700 },
            { height: 900, width: 1400 },
        );

        expect(bottom).toBe(900 - 700 + 40);
    });

    it('on a wide desktop viewport, uses the desktop-tuned offset unclamped', () => {
        // Cast button sits among other right-side playerbar icons (volume slider
        // etc.), so it's not flush with the window edge — plenty of room either side.
        const { right } = computePopoverPosition(
            { right: 1150, top: 700 },
            { height: 900, width: 1400 },
        );

        expect(right).toBe(1400 - 1150 - 120);
    });

    it('clamps to the minimum margin when the desktop offset would push the popover off the right edge', () => {
        // Narrow (mobile) viewport, button flush with the right edge — the -120
        // desktop offset would otherwise go negative (off-screen to the right).
        const { right } = computePopoverPosition(
            { right: 380, top: 700 },
            { height: 800, width: 380 },
        );

        expect(right).toBe(POPOVER_MARGIN);
    });

    it('clamps to the maximum bound when the popover would otherwise overflow the left edge', () => {
        // Narrow viewport, button near the left edge — a large `right` value here
        // would push the popover's left edge past the screen.
        const popoverWidth = Math.min(POPOVER_WIDTH, 380 - POPOVER_MARGIN * 2);
        const { right } = computePopoverPosition(
            { right: 50, top: 700 },
            { height: 800, width: 380 },
        );

        expect(right).toBe(380 - popoverWidth - POPOVER_MARGIN);
    });

    it('shrinks the effective popover width on narrow viewports (used for the max-right bound)', () => {
        // On a 320px-wide screen, min(350, 320 - 24) = 296, not the full 350px.
        const { right } = computePopoverPosition(
            { right: 30, top: 700 },
            { height: 800, width: 320 },
        );

        expect(right).toBe(320 - 296 - POPOVER_MARGIN);
    });
});
