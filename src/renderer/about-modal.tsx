import { closeAllModals, openModal } from '@mantine/modals';
import { useTranslation } from 'react-i18next';

import packageJson from '../../package.json';

import { Button } from '/@/shared/components/button/button';
import { Divider } from '/@/shared/components/divider/divider';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';

const AboutContent = () => {
    const { t } = useTranslation();

    return (
        <Stack gap="md">
            <Stack gap="xs">
                <Text fw={700} size="lg">
                    Feishin Connect
                </Text>
                <Text isMuted size="sm">
                    {t('common.version', { postProcess: 'sentenceCase' })}{' '}
                    {packageJson.version}
                </Text>
            </Stack>

            <Text size="sm">
                {t('page.about.description', {
                    defaultValue:
                        'A fork of Feishin with AirPlay and Sonos streaming support via a local Connect backend.',
                    postProcess: 'sentenceCase',
                })}
            </Text>

            <Divider />

            <Stack gap="xs">
                <Text fw={600} size="sm">
                    {t('page.about.thisProject', {
                        defaultValue: 'This project',
                        postProcess: 'sentenceCase',
                    })}
                </Text>
                <Button
                    component="a"
                    href="https://github.com/mihaitom/feishin-connect"
                    justify="flex-start"
                    rightSection={<Icon icon="externalLink" />}
                    target="_blank"
                    variant="subtle"
                >
                    github.com/mihaitom/feishin-connect
                </Button>
                <Button
                    component="a"
                    href="https://github.com/mihaitom/feishin-connect/issues"
                    justify="flex-start"
                    rightSection={<Icon icon="externalLink" />}
                    target="_blank"
                    variant="subtle"
                >
                    {t('page.about.reportIssue', {
                        defaultValue: 'Report an issue',
                        postProcess: 'sentenceCase',
                    })}
                </Button>
            </Stack>

            <Divider />

            <Stack gap="xs">
                <Text fw={600} size="sm">
                    {t('page.about.basedOn', {
                        defaultValue: 'Based on',
                        postProcess: 'sentenceCase',
                    })}
                </Text>
                <Text isMuted size="sm">
                    {t('page.about.originalCredit', {
                        defaultValue:
                            'Feishin Connect is built on top of Feishin by jeffvli. All core player functionality, UI, and architecture originate from the original project.',
                        postProcess: 'sentenceCase',
                    })}
                </Text>
                <Button
                    component="a"
                    href="https://github.com/jeffvli/feishin"
                    justify="flex-start"
                    rightSection={<Icon icon="externalLink" />}
                    target="_blank"
                    variant="subtle"
                >
                    github.com/jeffvli/feishin
                </Button>
            </Stack>

            <Group justify="flex-end" mt="xs">
                <Button onClick={() => closeAllModals()} variant="filled">
                    {t('common.close', { postProcess: 'titleCase' })}
                </Button>
            </Group>
        </Stack>
    );
};

export const openAboutModal = () => {
    openModal({
        children: <AboutContent />,
        size: 'md',
        title: 'About Feishin Connect',
    });
};
