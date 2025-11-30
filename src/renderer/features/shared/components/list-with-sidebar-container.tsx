import { motion } from 'motion/react';
import { createContext, ReactNode, useContext, useMemo, useRef } from 'react';

import styles from './list-with-sidebar-container.module.css';

import { useContainerQuery } from '/@/renderer/hooks';
import { animationProps } from '/@/shared/components/animations/animation-props';
import { Portal } from '/@/shared/components/portal/portal';

interface ListWithSidebarContainerContextValue {
    showSidebar: boolean;
    sidebarRef: React.RefObject<HTMLDivElement | null>;
}

const ListWithSidebarContainerContext = createContext<ListWithSidebarContainerContextValue | null>(
    null,
);

interface ListWithSidebarContainerProps {
    children: ReactNode;
    sidebarBreakpoint?: number;
}

interface SidebarPortalProps {
    children: ReactNode;
}

interface SidebarProps {
    children: ReactNode;
}

function Sidebar({ children }: SidebarProps) {
    const context = useContext(ListWithSidebarContainerContext);

    if (!context) {
        throw new Error('Sidebar must be used within ResponsiveAnimatedPage');
    }

    if (!context.showSidebar || !context.sidebarRef?.current) {
        return null;
    }

    return (
        <Portal target={context.sidebarRef.current}>
            <motion.div {...animationProps.slideInLeft} style={{ height: '100%', width: '100%' }}>
                {children}
            </motion.div>
        </Portal>
    );
}

function SidebarPortal({ children }: SidebarPortalProps) {
    const context = useContext(ListWithSidebarContainerContext);

    if (!context) {
        throw new Error('SidebarPortal must be used within ResponsiveAnimatedPage');
    }

    if (!context.showSidebar || !context.sidebarRef?.current) {
        return null;
    }

    return <Portal target={context.sidebarRef.current}>{children}</Portal>;
}

export const ListWithSidebarContainer = ({
    children,
    sidebarBreakpoint,
}: ListWithSidebarContainerProps) => {
    const sidebarRef = useRef<HTMLDivElement>(null);
    const { isLg, ref: containerQueryRef } = useContainerQuery({
        lg: sidebarBreakpoint,
    });

    const showSidebar = isLg;

    const contextValue = useMemo(
        () => ({
            showSidebar,
            sidebarRef,
        }),
        [showSidebar],
    );

    return (
        <ListWithSidebarContainerContext.Provider value={contextValue}>
            <div className={styles.container} ref={containerQueryRef}>
                <div
                    className={styles.sidebarContainer}
                    ref={sidebarRef}
                    style={{ display: showSidebar ? 'block' : 'none' }}
                />
                <div className={styles.contentContainer}>{children}</div>
            </div>
        </ListWithSidebarContainerContext.Provider>
    );
};

ListWithSidebarContainer.Sidebar = Sidebar;
ListWithSidebarContainer.SidebarPortal = SidebarPortal;
