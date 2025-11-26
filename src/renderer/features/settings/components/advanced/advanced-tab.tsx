import { Fragment } from 'react/jsx-runtime';

import { AnalyticsSettings } from '/@/renderer/features/settings/components/advanced/analytics-settings';
import { ExportImportSettings } from '/@/renderer/features/settings/components/advanced/export-import-settings';
import { CacheSettings } from '/@/renderer/features/settings/components/window/cache-settngs';
import { UpdateSettings } from '/@/renderer/features/settings/components/window/update-settings';
import { Divider } from '/@/shared/components/divider/divider';
import { Stack } from '/@/shared/components/stack/stack';

const sections = [
    { component: UpdateSettings, key: 'update' },
    { component: AnalyticsSettings, key: 'analytics' },
    { component: ExportImportSettings, key: 'export-import' },
    { component: CacheSettings, key: 'cache' },
];

export const AdvancedTab = () => {
    return (
        <Stack gap="md">
            {sections.map(({ component: Section, key }, index) => (
                <Fragment key={key}>
                    <Section />
                    {index < sections.length - 1 && <Divider />}
                </Fragment>
            ))}
        </Stack>
    );
};
