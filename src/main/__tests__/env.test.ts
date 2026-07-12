import { afterEach, describe, expect, it, vi } from 'vitest';

import { disableAutoUpdates } from '../env';

describe('disableAutoUpdates', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('is enabled by default (no env var set)', () => {
        vi.stubEnv('DISABLE_AUTO_UPDATES', '');

        expect(disableAutoUpdates()).toBe(false);
    });

    it('is disabled when the env var is set to any truthy value', () => {
        vi.stubEnv('DISABLE_AUTO_UPDATES', '1');

        expect(disableAutoUpdates()).toBe(true);
    });

    it('is disabled when the env var is set to "true"', () => {
        vi.stubEnv('DISABLE_AUTO_UPDATES', 'true');

        expect(disableAutoUpdates()).toBe(true);
    });
});
