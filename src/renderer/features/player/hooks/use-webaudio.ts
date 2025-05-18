import { useContext } from 'react';

import { WebAudioContext } from '/@/renderer/features/player/context/webaudio-context';

export const useWebAudio = () => {
    const { setWebAudio, webAudio } = useContext(WebAudioContext);
    return { setWebAudio, webAudio };
};
