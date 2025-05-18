import { ActionIcon, CopyButton, Group } from '@mantine/core';
import isElectron from 'is-electron';
import { useTranslation } from 'react-i18next';
import { RiCheckFill, RiClipboardFill, RiExternalLinkFill } from 'react-icons/ri';
import styled from 'styled-components';

import { toast, Tooltip } from '/@/renderer/components';

const util = isElectron() ? window.api.utils : null;

export type SongPathProps = {
    path: null | string;
};

const PathText = styled.div`
    user-select: all;
`;

export const SongPath = ({ path }: SongPathProps) => {
    const { t } = useTranslation();

    if (!path) return null;

    return (
        <Group>
            <CopyButton
                timeout={2000}
                value={path}
            >
                {({ copied, copy }) => (
                    <Tooltip
                        label={t(
                            copied ? 'page.itemDetail.copiedPath' : 'page.itemDetail.copyPath',
                            {
                                postProcess: 'sentenceCase',
                            },
                        )}
                        withinPortal
                    >
                        <ActionIcon onClick={copy}>
                            {copied ? <RiCheckFill /> : <RiClipboardFill />}
                        </ActionIcon>
                    </Tooltip>
                )}
            </CopyButton>
            {util && (
                <Tooltip
                    label={t('page.itemDetail.openFile', { postProcess: 'sentenceCase' })}
                    withinPortal
                >
                    <ActionIcon>
                        <RiExternalLinkFill
                            onClick={() => {
                                util.openItem(path).catch((error) => {
                                    toast.error({
                                        message: (error as Error).message,
                                        title: t('error.openError', {
                                            postProcess: 'sentenceCase',
                                        }),
                                    });
                                });
                            }}
                        />
                    </ActionIcon>
                </Tooltip>
            )}
            <PathText>{path}</PathText>
        </Group>
    );
};
