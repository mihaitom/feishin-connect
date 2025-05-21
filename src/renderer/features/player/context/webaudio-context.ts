import { createContext } from 'react';

import { WebAudio } from '/@/shared/types/types';

export const WebAudioContext = createContext<{
    setWebAudio?: (audio: WebAudio) => void;
    webAudio?: WebAudio;
}>({});
