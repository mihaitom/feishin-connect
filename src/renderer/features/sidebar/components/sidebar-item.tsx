import clsx from 'clsx';
import { memo } from 'react';
import { Link, LinkProps, useLocation } from 'react-router';

import styles from './sidebar-item.module.css';

import { Button, ButtonProps } from '/@/shared/components/button/button';

interface SidebarItemProps extends ButtonProps {
    to: LinkProps['to'];
}

export const SidebarItem = ({ children, className, to, ...props }: SidebarItemProps) => {
    const location = useLocation();
    const toPath = typeof to === 'string' ? to : to.pathname || '';
    const isActive = location.pathname === toPath;

    return (
        <Button
            className={clsx(
                {
                    [styles.active]: isActive,
                    [styles.disabled]: props.disabled,
                    [styles.link]: true,
                    [styles.root]: true,
                },
                className,
            )}
            classNames={{
                inner: styles.inner,
                label: styles.label,
            }}
            component={Link}
            to={to}
            variant="subtle"
            {...props}
        >
            {children}
        </Button>
    );
};

export const MemoizedSidebarItem = memo(SidebarItem);
