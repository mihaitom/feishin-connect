import { useRemoteQuery } from '/@/remote/hooks/use-remote-query';
import { useSend } from '/@/remote/store';
import { useRadioResponse } from '/@/remote/store/library';
import { RadioPage as SharedRadioPage } from '/@/shared/mobile-ui/containers/radio-page';
import { RemoteRadioItem } from '/@/shared/types/remote-types';

export const RadioPage = () => {
    const send = useSend();
    const response = useRadioResponse();

    const { items } = useRemoteQuery<RemoteRadioItem>({
        event: 'radio-request',
        paginated: false,
        response,
    });

    return <SharedRadioPage items={items} onPlay={(id) => send({ event: 'play-radio', id })} />;
};
