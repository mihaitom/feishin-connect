import { useState } from 'react';

import { ActionSheet } from '/@/shared/mobile-ui/components/action-sheet';
import { AddToPlaylistSheet } from '/@/shared/mobile-ui/containers/menus/add-to-playlist-sheet';
import { PlaySubmenuItems } from '/@/shared/mobile-ui/containers/menus/play-submenu-items';
import { TrackRadioSubmenuItems } from '/@/shared/mobile-ui/containers/menus/track-radio-submenu-items';
import { MobilePlaylistItem, Play, UseMobileSearch } from '/@/shared/mobile-ui/types';

interface TrackActionSheetProps {
    onAddToPlaylist: (playlistId: string, songId: string) => void;
    onClose: () => void;
    onPlay: (songId: string, playType: Play) => void;
    onPlayTrackRadio: (songId: string, playType: Play) => void;
    track: null | { id: string; name: string };
    usePlaylistSearch: UseMobileSearch<MobilePlaylistItem>;
}

type TrackActionSheetView = 'addToPlaylist' | 'play' | 'root' | 'trackRadio';

export const TrackActionSheet = ({
    onAddToPlaylist,
    onClose,
    onPlay,
    onPlayTrackRadio,
    track,
    usePlaylistSearch,
}: TrackActionSheetProps) => {
    const [view, setView] = useState<TrackActionSheetView>('root');

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
                            onPlay(track.id, playType);
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
                            onPlayTrackRadio(track.id, playType);
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
                            onAddToPlaylist(playlistId, track.id);
                            handleClose();
                        }}
                        usePlaylistSearch={usePlaylistSearch}
                    />
                </>
            )}
        </ActionSheet>
    );
};
