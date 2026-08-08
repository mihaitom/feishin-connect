import {
    RiHome5Line,
    RiListOrdered2,
    RiMusic2Line,
    RiPlayListLine,
    RiRadioLine,
} from 'react-icons/ri';
import { NavLink } from 'react-router';

import styles from './tab-bar.module.css';

interface Tab {
    icon: React.ReactNode;
    label: string;
    to: string;
}

const TABS: Tab[] = [
    { icon: <RiHome5Line size={22} />, label: 'Home', to: '/' },
    { icon: <RiMusic2Line size={22} />, label: 'Tracks', to: '/tracks' },
    { icon: <RiPlayListLine size={22} />, label: 'Playlists', to: '/playlists' },
    { icon: <RiRadioLine size={22} />, label: 'Radio', to: '/radio' },
    { icon: <RiListOrdered2 size={22} />, label: 'Queue', to: '/queue' },
];

export const TabBar = () => {
    return (
        <nav className={styles.tabBar}>
            {TABS.map((tab) => (
                <NavLink
                    className={({ isActive }) =>
                        isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
                    }
                    end={tab.to === '/'}
                    key={tab.to}
                    to={tab.to}
                >
                    {tab.icon}
                    <span className={styles.tabLabel}>{tab.label}</span>
                </NavLink>
            ))}
        </nav>
    );
};
