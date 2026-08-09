import { useMobileRadioList } from '/@/renderer/features/mobile/hooks/use-mobile-radio-list';
import { radioQueries } from '/@/renderer/features/radio/api/radio-api';
import { useRadioStore } from '/@/renderer/features/radio/hooks/use-radio-player';
import { queryClient } from '/@/renderer/lib/react-query';
import { useAuthStore } from '/@/renderer/store/auth.store';
import { RadioPage as SharedRadioPage } from '/@/shared/mobile-ui/containers/radio-page';

export const RadioPage = () => {
    const items = useMobileRadioList();

    const onPlay = async (id: string) => {
        const server = useAuthStore.getState().currentServer;
        if (!server) return;

        try {
            const stations = await queryClient.fetchQuery(
                radioQueries.list({ query: undefined, serverId: server.id }),
            );
            const station = stations.find((s) => s.id === id);
            if (!station) return;

            useRadioStore.getState().actions.play(station.streamUrl, station.name, {
                id: station.id,
                imageId: station.imageId,
                imageUrl: station.imageUrl,
                serverId: server.id,
            });
        } catch {
            // Nothing to do — station list fetch failed.
        }
    };

    return <SharedRadioPage items={items} onPlay={onPlay} />;
};
