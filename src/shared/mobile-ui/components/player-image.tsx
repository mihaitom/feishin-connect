import clsx from 'clsx';

import styles from './player-image.module.css';

interface PlayerImageProps {
    className?: string;
    onError?: () => void;
    src?: null | string;
}
export const PlayerImage = ({ className, onError, src }: PlayerImageProps) => {
    return (
        <img
            className={clsx(styles.container, className)}
            onError={onError}
            src={src?.replaceAll(/&(size|width|height)=\d+/g, '')}
        />
    );
};
