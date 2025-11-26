import dayjs from 'dayjs';

export enum LogCategory {
    ANALYTICS = 'analytics',
    API = 'api',
    OTHER = 'other',
    PLAYER = 'player',
    SYSTEM = 'system',
}

export type LogLevel = 'debug' | 'error' | 'info' | 'warn';

interface LogFn {
    (
        message?: string,
        options?: {
            category?: string;
            meta?: any;
        },
    ): void;
}

interface Logger {
    debug: LogFn;
    error: LogFn;
    info: LogFn;
    warn: LogFn;
}

const DEFAULT_LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NO_OP: LogFn = (_message?: string, ..._optionalParams: any[]) => {};

const colors = {
    debug: '\x1B[38;2;54;96;146m', // #366092
    error: '\x1B[38;2;240;0;0m', // #f00000
    info: '\x1B[38;2;0;125;60m', // #007d3c
    warn: '\x1B[38;2;225;125;50m', // #e17d32
};

// Debounce configuration
const DEBOUNCE_INTERVAL = 200; // milliseconds
const DEBOUNCE_MAP = new Map<string, { count: number; lastLog: number }>();

// Periodically flush the debounce map
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of DEBOUNCE_MAP.entries()) {
        if (now - value.lastLog >= DEBOUNCE_INTERVAL) {
            const [level, message, category, meta] = JSON.parse(key);
            const timestampStr = `${dayjs().format('HH:mm:ss')}`;
            const levelStr = `${colors[level as keyof typeof colors]}[${String(level).toUpperCase().padEnd(5, ' ')}]\x1B[0m`;
            const countStr = value.count > 1 ? ` (x${value.count})` : '';
            const categoryStr = category
                ? String(`[${category.padEnd(9, ' ')}]`).toUpperCase()
                : '';
            const messageStr = message ? String(message) : '';
            const logStr = `[${timestampStr}] ${levelStr} ${categoryStr} ${messageStr}${countStr}`;

            if (meta) {
                console.log(logStr, meta);
            } else {
                console.log(logStr);
            }

            DEBOUNCE_MAP.delete(key);
        }
    }
}, DEBOUNCE_INTERVAL);

class ConsoleLogger implements Logger {
    readonly debug: LogFn;
    readonly error: LogFn;
    readonly info: LogFn;
    readonly warn: LogFn;

    constructor() {
        const level = localStorage.getItem('log_level') || DEFAULT_LOG_LEVEL;

        // Create timestamp wrapper function with colors and debouncing
        const withTimestamp = (logLevel: string): LogFn => {
            return (message?: any, options?: { category?: string; meta?: any }) => {
                const { category, meta } = options || {};
                const key = JSON.stringify([logLevel, message, category, meta]);
                const now = Date.now();
                const existing = DEBOUNCE_MAP.get(key);

                if (existing) {
                    existing.count++;
                    existing.lastLog = now;
                } else {
                    DEBOUNCE_MAP.set(key, { count: 1, lastLog: now });
                }
            };
        };

        this.error = withTimestamp('error');

        if (level === 'error') {
            this.warn = NO_OP;
            this.info = NO_OP;
            this.debug = NO_OP;
            return;
        }

        this.warn = withTimestamp('warn');

        if (level === 'warn') {
            this.info = NO_OP;
            this.debug = NO_OP;
            return;
        }

        this.info = withTimestamp('info');

        if (level === 'info') {
            this.debug = NO_OP;
            return;
        }

        this.debug = withTimestamp('debug');
    }
}

export const logFn = new ConsoleLogger();
