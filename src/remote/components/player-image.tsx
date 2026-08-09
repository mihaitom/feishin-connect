import clsx from 'clsx';

import styles from './player-image.module.css';

import { useSend } from '/@/remote/store';

interface PlayerImageProps {
    className?: string;
    src?: null | string;
}
export const PlayerImage = ({ className, src }: PlayerImageProps) => {
    const send = useSend();

    return (
        <img
            className={clsx(styles.container, className)}
            onError={() => send({ event: 'proxy' })}
            src={src?.replaceAll(/&(size|width|height)=\d+/g, '')}
        />
    );
};
