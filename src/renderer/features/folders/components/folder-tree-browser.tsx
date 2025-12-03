import { type UseQueryResult } from '@tanstack/react-query';
import clsx from 'clsx';
import { useOverlayScrollbars } from 'overlayscrollbars-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { List, RowComponentProps } from 'react-window-v2';

import styles from './folder-tree-browser.module.css';

import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import { useFolderListFilters } from '/@/renderer/features/folders/hooks/use-folder-list-filters';
import { useDragDrop } from '/@/renderer/hooks/use-drag-drop';
import { Icon } from '/@/shared/components/icon/icon';
import { Tooltip } from '/@/shared/components/tooltip/tooltip';
import { Folder, LibraryItem } from '/@/shared/types/domain-types';
import { DragOperation, DragTarget } from '/@/shared/types/drag-and-drop';

interface FlattenedNode {
    depth: number;
    folder: Folder;
    hasChildren: boolean;
    isExpanded: boolean;
    path: Array<{ id: string; name: string }>;
}

interface TreeNode {
    childrenLoaded: boolean;
    depth: number;
    folder: Folder;
    hasChildren: boolean;
    isExpanded: boolean;
}

const ITEM_HEIGHT = 32;
const INDENT_SIZE = 16;

interface FolderTreeBrowserProps {
    fetchFolder: (folderId: string) => Promise<Folder>;
    rootFolderQuery: UseQueryResult<Folder, Error>;
}

export const FolderTreeBrowser = ({ fetchFolder, rootFolderQuery }: FolderTreeBrowserProps) => {
    const { currentFolderId, setFolderPath } = useFolderListFilters();
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [loadedNodes, setLoadedNodes] = useState<Map<string, Folder[]>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize root folder children when data is loaded
    useEffect(() => {
        if (rootFolderQuery.data?.children?.folders && !loadedNodes.has('0')) {
            setLoadedNodes((prev) => {
                const newMap = new Map(prev);
                newMap.set('0', rootFolderQuery.data?.children?.folders || []);
                return newMap;
            });
        }
    }, [rootFolderQuery.data, loadedNodes]);

    // Fetch folder when expanding a node
    const fetchFolderChildren = useCallback(
        async (folderId: string) => {
            if (loadedNodes.has(folderId)) {
                return;
            }

            try {
                const result = await fetchFolder(folderId);

                if (result?.children?.folders) {
                    setLoadedNodes((prev) => {
                        const newMap = new Map(prev);
                        const folders = result?.children?.folders || [];
                        newMap.set(folderId, folders);
                        return newMap;
                    });
                } else {
                    // Even if no children, mark as loaded to avoid refetching
                    setLoadedNodes((prev) => {
                        const newMap = new Map(prev);
                        newMap.set(folderId, []);
                        return newMap;
                    });
                }
            } catch {
                setLoadedNodes((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(folderId, []);
                    return newMap;
                });
            }
        },
        [fetchFolder, loadedNodes],
    );

    // Get children for a folder
    const getFolderChildren = useCallback(
        (folder: Folder): Folder[] => {
            // First check if we have explicitly loaded children in loadedNodes
            const loaded = loadedNodes.get(folder.id);
            if (loaded !== undefined) {
                return loaded;
            }

            // Otherwise, use children from the folder object itself (if available)
            // This handles cases where children came with the parent folder's response
            return folder.children?.folders || [];
        },
        [loadedNodes],
    );

    // Build tree structure from root
    const buildTree = useCallback(
        (folder: Folder, depth: number = 0): TreeNode => {
            const folderId = folder.id;
            const isExpanded = expandedNodes.has(folderId);
            const children = getFolderChildren(folder);
            const hasChildren = children.length > 0;
            const childrenLoaded =
                loadedNodes.has(folderId) || (folder.children?.folders?.length ?? 0) > 0;

            return {
                childrenLoaded,
                depth,
                folder,
                hasChildren,
                isExpanded,
            };
        },
        [expandedNodes, loadedNodes, getFolderChildren],
    );

    // Flatten tree to list for virtualization
    const flattenedNodes = useMemo((): FlattenedNode[] => {
        if (!rootFolderQuery.data) {
            return [];
        }

        const result: FlattenedNode[] = [];
        const rootFolder = rootFolderQuery.data;

        const traverse = (
            folder: Folder,
            depth: number,
            path: Array<{ id: string; name: string }> = [],
        ) => {
            const node = buildTree(folder, depth);
            const currentPath = [...path, { id: folder.id, name: folder.name }];
            const isRoot = folder.id === '0';

            // Skip the root folder (id: '0')
            if (!isRoot) {
                result.push({
                    depth: node.depth - 1,
                    folder: node.folder,
                    hasChildren: node.hasChildren,
                    isExpanded: node.isExpanded,
                    path: currentPath,
                });
            }

            // For root folder, always traverse children
            const shouldTraverseChildren = isRoot
                ? node.hasChildren
                : node.isExpanded && node.hasChildren;

            if (shouldTraverseChildren) {
                const children = getFolderChildren(folder);
                // Recursively traverse each child - this supports infinite nesting
                children.forEach((child) => {
                    traverse(child, depth + 1, currentPath);
                });
            }
        };

        traverse(rootFolder, 0);
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rootFolderQuery.data, expandedNodes, loadedNodes, buildTree, getFolderChildren]);

    const toggleNode = useCallback(
        (folderId: string, hasChildren: boolean, folder?: Folder) => {
            setExpandedNodes((prev) => {
                const newSet = new Set(prev);
                if (newSet.has(folderId)) {
                    newSet.delete(folderId);
                } else {
                    newSet.add(folderId);
                    // Fetch children if not loaded and has children
                    // Check both loadedNodes and folder.children to determine if we need to fetch
                    const needsFetch =
                        hasChildren &&
                        !loadedNodes.has(folderId) &&
                        !(folder?.children?.folders && folder.children.folders.length > 0);
                    if (needsFetch) {
                        fetchFolderChildren(folderId);
                    }
                }
                return newSet;
            });
        },
        [fetchFolderChildren, loadedNodes],
    );

    // Expand a node (doesn't collapse if already expanded)
    const expandNode = useCallback(
        (folderId: string, hasChildren: boolean, folder?: Folder) => {
            setExpandedNodes((prev) => {
                if (prev.has(folderId)) {
                    return prev;
                }

                // Expand the node
                const newSet = new Set(prev);
                newSet.add(folderId);

                // Fetch children if not loaded and has children
                const needsFetch =
                    hasChildren &&
                    !loadedNodes.has(folderId) &&
                    !(folder?.children?.folders && folder.children.folders.length > 0);
                if (needsFetch) {
                    fetchFolderChildren(folderId);
                }

                return newSet;
            });
        },
        [fetchFolderChildren, loadedNodes],
    );

    // Handle node click - toggle expand/collapse and set current folder
    const handleNodeClick = useCallback(
        (
            folder: Folder,
            path: Array<{ id: string; name: string }>,
            isExpanded: boolean,
            isCurrentFolder: boolean,
        ) => {
            // Only toggle close if the node is expanded AND it's the current folder
            if (isExpanded && isCurrentFolder) {
                toggleNode(folder.id, true, folder);
            } else if (!isExpanded) {
                // Node is not expanded - check if we should expand it
                const childrenLoaded = loadedNodes.has(folder.id);
                const hasChildrenFromFolder = (folder.children?.folders?.length ?? 0) > 0;

                // Determine if we should expand:
                // - If children are loaded and empty, don't expand (we know it has no children)
                // - Otherwise, try to expand/fetch (either has children or we don't know yet)
                let shouldExpand = false;
                let mightHaveChildren = false;

                if (childrenLoaded) {
                    // Children are loaded - check if there are any
                    const loadedChildren = loadedNodes.get(folder.id) || [];
                    shouldExpand = loadedChildren.length > 0;
                    mightHaveChildren = loadedChildren.length > 0;
                } else {
                    // Children not loaded yet - assume it might have children and try to expand
                    shouldExpand = true;
                    mightHaveChildren = true;
                }

                // Override with folder's children if available (from parent response)
                if (hasChildrenFromFolder) {
                    shouldExpand = true;
                    mightHaveChildren = true;
                }

                if (shouldExpand) {
                    expandNode(folder.id, mightHaveChildren, folder);
                }
            }

            // Set current folder path (full path from root to clicked folder)
            // Skip the root folder (id: '0') from the path
            const pathWithoutRoot = path.filter((item) => item.id !== '0');
            setFolderPath(pathWithoutRoot);
        },
        [expandNode, loadedNodes, setFolderPath, toggleNode],
    );

    const rowProps = useMemo(
        () => ({
            currentFolderId,
            data: flattenedNodes,
            handleNodeClick,
            toggleNode,
        }),
        [currentFolderId, flattenedNodes, handleNodeClick, toggleNode],
    );

    const [initialize, osInstance] = useOverlayScrollbars({
        defer: false,
        events: {
            initialized(osInstance) {
                const { viewport } = osInstance.elements();
                viewport.style.overflowX = `var(--os-viewport-overflow-x)`;
            },
        },
        options: {
            overflow: { x: 'hidden', y: 'scroll' },
            paddingAbsolute: true,
            scrollbars: {
                autoHide: 'leave',
                autoHideDelay: 500,
                pointers: ['mouse', 'pen', 'touch'],
                theme: 'feishin-os-scrollbar',
                visibility: 'visible',
            },
        },
    });

    useEffect(() => {
        const { current: container } = containerRef;

        if (!container || !container.firstElementChild) {
            return;
        }

        const viewport = container.firstElementChild as HTMLElement;

        initialize({
            elements: { viewport },
            target: container,
        });

        return () => osInstance()?.destroy();
    }, [initialize, osInstance]);

    return (
        <div className={styles.container} ref={containerRef}>
            <List
                rowComponent={RowComponent}
                rowCount={flattenedNodes.length}
                rowHeight={ITEM_HEIGHT}
                rowProps={rowProps}
            />
        </div>
    );
};

const RowComponent = ({
    currentFolderId,
    data,
    handleNodeClick,
    index,
    style,
    toggleNode,
}: RowComponentProps<{
    currentFolderId: null | string;
    data: FlattenedNode[];
    handleNodeClick: (
        folder: Folder,
        path: Array<{ id: string; name: string }>,
        isExpanded: boolean,
        isCurrentFolder: boolean,
    ) => void;
    toggleNode: (folderId: string, hasChildren: boolean, folder?: Folder) => void;
}>) => {
    const item = data[index];
    const folderNameRef = useRef<HTMLSpanElement>(null);
    const folderIconRef = useRef<HTMLDivElement>(null);
    const expandIconRef = useRef<HTMLDivElement | null>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const [tooltipOffset, setTooltipOffset] = useState(0);

    useLayoutEffect(() => {
        if (!item) {
            return;
        }

        const calculateOffset = () => {
            if (rowRef.current && folderIconRef.current && expandIconRef.current) {
                const width = rowRef.current.offsetWidth;
                const paddingLeft = item.depth * INDENT_SIZE;
                const folderIconWidth = folderIconRef.current.offsetWidth;
                const expandIconWidth = expandIconRef.current.offsetWidth;
                const itemPadding = 8;
                setTooltipOffset(
                    -width + paddingLeft + folderIconWidth + expandIconWidth + itemPadding,
                );
            }
        };

        calculateOffset();

        const handleResize = () => {
            calculateOffset();
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [item]);

    const { isDragging, ref: dragRef } = useDragDrop<HTMLDivElement>({
        drag: {
            getId: () => (item ? [item.folder.id] : []),
            getItem: () => (item ? [item.folder] : []),
            itemType: LibraryItem.FOLDER,
            operation: [DragOperation.ADD],
            target: DragTarget.FOLDER,
        },
        isEnabled: !!item,
    });

    // Use dragRef for the element and also update rowRef for tooltip calculations
    useEffect(() => {
        if (dragRef && 'current' in dragRef && dragRef.current) {
            rowRef.current = dragRef.current;
        }
    }, [dragRef]);

    if (!item) {
        return <div style={style} />;
    }

    const isActive = currentFolderId === item.folder.id;
    const paddingLeft = item.depth * INDENT_SIZE;

    const handleExpandClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleNode(item.folder.id, item.hasChildren, item.folder);
    };

    const handleRowClick = () => {
        handleNodeClick(item.folder, item.path, item.isExpanded, isActive);
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        ContextMenuController.call({
            cmd: {
                items: [item.folder],
                type: LibraryItem.FOLDER,
            },
            event: e,
        });
    };

    return (
        <Tooltip
            classNames={{
                tooltip: styles.tooltip,
            }}
            label={item.folder.name}
            offset={tooltipOffset}
            openDelay={0}
            position="right"
            withArrow={false}
        >
            <div
                className={clsx(styles.row, {
                    [styles.active]: isActive,
                    [styles.dragging]: isDragging,
                })}
                onClick={handleRowClick}
                onContextMenu={handleContextMenu}
                ref={dragRef}
                style={{
                    ...style,
                    paddingLeft: `${paddingLeft}px`,
                }}
            >
                <div className={styles.rowContent}>
                    {item.hasChildren ? (
                        <div className={styles.expandIconContainer} ref={expandIconRef}>
                            <Icon
                                className={clsx(styles.expandIcon, {
                                    [styles.expanded]: item.isExpanded,
                                })}
                                icon="arrowRightS"
                                onClick={handleExpandClick}
                                size="sm"
                            />
                        </div>
                    ) : (
                        <div className={styles.expandIconPlaceholder} ref={expandIconRef} />
                    )}
                    <div className={styles.folderIconContainer} ref={folderIconRef}>
                        <Icon className={styles.folderIcon} icon="folder" size="md" />
                    </div>
                    <span className={styles.folderName} ref={folderNameRef}>
                        {item.folder.name}
                    </span>
                </div>
            </div>
        </Tooltip>
    );
};
