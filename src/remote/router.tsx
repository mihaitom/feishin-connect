import { Route, Routes } from 'react-router';

import { RemoteContainer } from '/@/remote/components/remote-container';
import { PlaylistsPage } from '/@/remote/pages/playlists-page';
import { QueuePage } from '/@/remote/pages/queue-page';
import { RadioPage } from '/@/remote/pages/radio-page';
import { TracksPage } from '/@/remote/pages/tracks-page';

export const RemoteRoutes = () => {
    return (
        <Routes>
            <Route element={<RemoteContainer />} index />
            <Route element={<TracksPage />} path="tracks" />
            <Route element={<PlaylistsPage />} path="playlists" />
            <Route element={<RadioPage />} path="radio" />
            <Route element={<QueuePage />} path="queue" />
        </Routes>
    );
};
