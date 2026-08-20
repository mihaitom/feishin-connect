import { useState } from 'react';

import { ActionSheet } from '/@/remote/components/action-sheet';
import { AddToPlaylistSheet } from '/@/remote/components/menus/add-to-playlist-sheet';
import { PlaySubmenuItems } from '/@/remote/components/menus/play-submenu-items';
import { TrackRadioSubmenuItems } from '/@/remote/components/menus/track-radio-submenu-items';
import { useConfirmedSend } from '/@/remote/hooks/use-confirmed-send';
import { useSend } from '/@/remote/store';

interface TrackActionSheetProps {
    onClose: () => void;
    track: null | { id: string; name: string };
}

type TrackActionSheetView = 'addToPlaylist' | 'play' | 'root' | 'trackRadio';

export const TrackActionSheet = ({ onClose, track }: TrackActionSheetProps) => {
    const [view, setView] = useState<TrackActionSheetView>('root');
    const send = useSend();
    const confirmedSend = useConfirmedSend();

    const handleClose = () => {
        onClose();
        // Reset after the close animation finishes so a reopen doesn't flash
        // the previously drilled-into view.
        window.setTimeout(() => setView('root'), 200);
    };

    return (
        <ActionSheet onClose={handleClose} opened={!!track}>
            {track && view === 'root' && (
                <>
                    <ActionSheet.Item
                        leftIcon="mediaPlay"
                        onClick={() => setView('play')}
                        rightIcon="arrowRightS"
                    >
                        Play
                    </ActionSheet.Item>
                    <ActionSheet.Item
                        leftIcon="radio"
                        onClick={() => setView('trackRadio')}
                        rightIcon="arrowRightS"
                    >
                        Track Radio
                    </ActionSheet.Item>
                    <ActionSheet.Item
                        leftIcon="playlist"
                        onClick={() => setView('addToPlaylist')}
                        rightIcon="arrowRightS"
                    >
                        Add to Playlist
                    </ActionSheet.Item>
                </>
            )}
            {track && view === 'play' && (
                <>
                    <ActionSheet.Header onBack={() => setView('root')} title={track.name} />
                    <PlaySubmenuItems
                        onSelect={(playType) => {
                            confirmedSend({ event: 'play-track', id: track.id, playType });
                            handleClose();
                        }}
                    />
                </>
            )}
            {track && view === 'trackRadio' && (
                <>
                    <ActionSheet.Header onBack={() => setView('root')} title="Track Radio" />
                    <TrackRadioSubmenuItems
                        onSelect={(playType) => {
                            confirmedSend({ event: 'play-track-radio', id: track.id, playType });
                            handleClose();
                        }}
                    />
                </>
            )}
            {track && view === 'addToPlaylist' && (
                <>
                    <ActionSheet.Header onBack={() => setView('root')} title="Add to Playlist" />
                    <AddToPlaylistSheet
                        onSelect={(playlistId) => {
                            send({ event: 'add-to-playlist', playlistId, songId: track.id });
                            handleClose();
                        }}
                    />
                </>
            )}
        </ActionSheet>
    );
};
