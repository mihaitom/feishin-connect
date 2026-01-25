import { useEffect, useRef, useState } from 'react';

interface UseDebouncedValueOptions {
    waitForInitial?: boolean;
}

export function useDebouncedValue<T>(
    value: T,
    delay: number,
    options?: UseDebouncedValueOptions,
): [T | undefined] {
    const { waitForInitial = false } = options || {};
    const [debouncedValue, setDebouncedValue] = useState<T | undefined>(
        waitForInitial ? undefined : value,
    );
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set up a new timeout to update the debounced value
        timeoutRef.current = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Cleanup function to clear the timeout if the component unmounts or value changes
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [value, delay]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return [debouncedValue];
}
