import { connectFetch } from './types';

export const useConnectSeek = () => (position: number) =>
    connectFetch('/seek', {
        body: JSON.stringify({ position }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
    }).catch(() => {});
