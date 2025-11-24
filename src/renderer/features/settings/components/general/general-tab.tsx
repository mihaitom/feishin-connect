import { Fragment } from 'react/jsx-runtime';

import { ApplicationSettings } from '/@/renderer/features/settings/components/general/application-settings';
import { ControlSettings } from '/@/renderer/features/settings/components/general/control-settings';
import { LyricSettings } from '/@/renderer/features/settings/components/general/lyric-settings';
import { RemoteSettings } from '/@/renderer/features/settings/components/general/remote-settings';
import { ScrobbleSettings } from '/@/renderer/features/settings/components/general/scrobble-settings';
import { SidebarSettings } from '/@/renderer/features/settings/components/general/sidebar-settings';
import { ThemeSettings } from '/@/renderer/features/settings/components/general/theme-settings';
import { Divider } from '/@/shared/components/divider/divider';
import { Stack } from '/@/shared/components/stack/stack';

const sections = [
    { component: ApplicationSettings, key: 'application' },
    { component: ThemeSettings, key: 'theme' },
    { component: ControlSettings, key: 'control' },
    { component: SidebarSettings, key: 'sidebar' },
    { component: RemoteSettings, key: 'remote' },
    { component: ScrobbleSettings, key: 'scrobble' },
    { component: LyricSettings, key: 'lyrics' },
];

export const GeneralTab = () => {
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
