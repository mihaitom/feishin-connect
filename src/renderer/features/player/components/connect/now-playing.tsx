import { LuMusic2, LuRadio } from 'react-icons/lu';

import { ConnectStatus } from './types';

interface NowPlayingProps {
    connectStatus: ConnectStatus | null;
}

export const NowPlayingSection = ({ connectStatus }: NowPlayingProps) => {
    const track = connectStatus?.current_track ?? null;
    const radio = connectStatus?.radio ?? null;
    const isRadioMode = !!radio;

    const title = track?.title ?? radio?.title ?? '…';
    const artist = track?.artist ?? '';
    const imageUrl = track?.cover_art_url ?? null;

    return (
        <>
            <div
                style={{
                    alignItems: 'center',
                    display: 'flex',
                    gap: '10px',
                    padding: '12px 12px 10px',
                }}
            >
                {imageUrl ? (
                    <img
                        alt=""
                        src={imageUrl}
                        style={{
                            borderRadius: '4px',
                            flexShrink: 0,
                            height: '48px',
                            objectFit: 'cover',
                            width: '48px',
                        }}
                    />
                ) : (
                    <div
                        style={{
                            alignItems: 'center',
                            background: 'rgba(255,255,255,0.06)',
                            borderRadius: '4px',
                            color: 'var(--theme-colors-text-secondary)',
                            display: 'flex',
                            flexShrink: 0,
                            height: '48px',
                            justifyContent: 'center',
                            width: '48px',
                        }}
                    >
                        {isRadioMode ? <LuRadio size={20} /> : <LuMusic2 size={20} />}
                    </div>
                )}
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            color: 'var(--theme-colors-text-primary)',
                            fontSize: '14px',
                            fontWeight: 600,
                            overflow: 'hidden',
                            paddingRight: '12px',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {title}
                    </div>
                    {artist && (
                        <div
                            style={{
                                color: 'var(--theme-colors-text-secondary)',
                                fontSize: '13px',
                                overflow: 'hidden',
                                paddingRight: '12px',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {artist}
                        </div>
                    )}
                </div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
        </>
    );
};
