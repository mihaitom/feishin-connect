import { ReactNode, useCallback, useState } from 'react';

import styles from './collapsible-command-group.module.css';

import { Icon } from '/@/shared/components/icon/icon';
import { Paper } from '/@/shared/components/paper/paper';

interface CollapsibleCommandGroupProps {
    children: ReactNode;
    defaultExpanded?: boolean;
    heading: string;
}

export function CollapsibleCommandGroup({
    children,
    defaultExpanded = true,
    heading,
}: CollapsibleCommandGroupProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    const toggle = useCallback(() => {
        setExpanded((prev) => !prev);
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        },
        [toggle],
    );

    return (
        <div className={styles.root}>
            <Paper p="xs" radius="sm" withBorder>
                <div
                    className={styles.heading}
                    onClick={toggle}
                    onKeyDown={handleKeyDown}
                    role="button"
                    tabIndex={0}
                >
                    <Icon className={styles.chevron} icon={expanded ? 'dropdown' : 'arrowRightS'} />
                    <span>{heading}</span>
                </div>
            </Paper>
            {expanded && <div className={styles.items}>{children}</div>}
        </div>
    );
}
