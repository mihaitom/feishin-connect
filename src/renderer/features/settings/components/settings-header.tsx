import { Flex, Group } from '@mantine/core';
import { closeAllModals, openModal } from '@mantine/modals';
import { useTranslation } from 'react-i18next';
import { RiSettings2Fill } from 'react-icons/ri';

import { useSettingsStoreActions } from '../../../store/settings.store';

import { Button, ConfirmModal, PageHeader, SearchInput } from '/@/renderer/components';
import { useSettingSearchContext } from '/@/renderer/features/settings/context/search-context';
import { LibraryHeaderBar } from '/@/renderer/features/shared';
import { useContainerQuery } from '/@/renderer/hooks';

export type SettingsHeaderProps = {
    setSearch: (search: string) => void;
};

export const SettingsHeader = ({ setSearch }: SettingsHeaderProps) => {
    const { t } = useTranslation();
    const { reset } = useSettingsStoreActions();
    const search = useSettingSearchContext();
    const cq = useContainerQuery();

    const handleResetToDefault = () => {
        reset();
        closeAllModals();
    };

    const openResetConfirmModal = () => {
        openModal({
            children: (
                <ConfirmModal onConfirm={handleResetToDefault}>
                    {t('common.areYouSure', { postProcess: 'sentenceCase' })}
                </ConfirmModal>
            ),
            title: t('common.resetToDefault', { postProcess: 'sentenceCase' }),
        });
    };

    return (
        <Flex ref={cq.ref}>
            <PageHeader>
                <LibraryHeaderBar>
                    <Flex
                        align="center"
                        justify="space-between"
                        w="100%"
                    >
                        <Group noWrap>
                            <RiSettings2Fill size="2rem" />
                            <LibraryHeaderBar.Title>
                                {t('common.setting', { count: 2, postProcess: 'titleCase' })}
                            </LibraryHeaderBar.Title>
                        </Group>
                        <Group>
                            <SearchInput
                                defaultValue={search}
                                onChange={(event) =>
                                    setSearch(event.target.value.toLocaleLowerCase())
                                }
                                openedWidth={cq.isMd ? 250 : cq.isSm ? 200 : 150}
                            />
                            <Button
                                compact
                                onClick={openResetConfirmModal}
                                variant="default"
                            >
                                {t('common.resetToDefault', { postProcess: 'sentenceCase' })}
                            </Button>
                        </Group>
                    </Flex>
                </LibraryHeaderBar>
            </PageHeader>
        </Flex>
    );
};
