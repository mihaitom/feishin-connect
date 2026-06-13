import '@testing-library/jest-dom/vitest';

// jsdom does not implement EventSource. Provide a minimal stub so code that
// constructs one (e.g. connectEventSource) can be tested without a real
// SSE connection.
class MockEventSource {
    onerror: ((ev: Event) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onopen: ((ev: Event) => void) | null = null;
    readyState = 0;
    url: string;

    constructor(url: string) {
        this.url = url;
    }

    close() {
        this.readyState = 2;
    }
}

(globalThis as any).EventSource = MockEventSource;
