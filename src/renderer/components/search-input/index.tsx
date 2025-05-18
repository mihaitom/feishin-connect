import { ActionIcon, TextInputProps } from '@mantine/core';
import { useFocusWithin, useHotkeys, useMergedRef } from '@mantine/hooks';
import { ChangeEvent, KeyboardEvent } from 'react';
import { RiCloseFill, RiSearchLine } from 'react-icons/ri';
import { shallow } from 'zustand/shallow';

import { TextInput } from '/@/renderer/components/input';
import { useSettingsStore } from '/@/renderer/store';

interface SearchInputProps extends TextInputProps {
    initialWidth?: number;
    openedWidth?: number;
    value?: string;
}

export const SearchInput = ({
    initialWidth,
    onChange,
    openedWidth,
    ...props
}: SearchInputProps) => {
    const { focused, ref } = useFocusWithin();
    const mergedRef = useMergedRef<HTMLInputElement>(ref);
    const binding = useSettingsStore((state) => state.hotkeys.bindings.localSearch, shallow);

    const isOpened = focused || ref.current?.value;
    const showIcon = !isOpened || (openedWidth || 100) > 100;

    useHotkeys([[binding.hotkey, () => ref.current.select()]]);

    const handleEscape = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.code === 'Escape') {
            onChange?.({ target: { value: '' } } as ChangeEvent<HTMLInputElement>);
            ref.current.value = '';
            ref.current.blur();
        }
    };

    return (
        <TextInput
            ref={mergedRef}
            {...props}
            icon={showIcon && <RiSearchLine />}
            onChange={onChange}
            onKeyDown={handleEscape}
            rightSection={
                isOpened ? (
                    <ActionIcon
                        onClick={() => {
                            ref.current.value = '';
                            ref.current.focus();
                            onChange?.({ target: { value: '' } } as ChangeEvent<HTMLInputElement>);
                        }}
                    >
                        <RiCloseFill />
                    </ActionIcon>
                ) : null
            }
            size="md"
            styles={{
                icon: { svg: { fill: 'var(--titlebar-fg)' } },
                input: {
                    backgroundColor: isOpened ? 'inherit' : 'transparent !important',
                    border: 'none !important',
                    cursor: isOpened ? 'text' : 'pointer',
                    padding: isOpened ? '10px' : 0,
                },
            }}
            width={isOpened ? openedWidth || 150 : initialWidth || 35}
        />
    );
};
