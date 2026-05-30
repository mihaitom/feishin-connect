import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { api } from '/@/renderer/api';
import { MutationHookArgs } from '/@/renderer/lib/react-query';
import { StartScanArgs, StartScanResponse } from '/@/shared/types/domain-types';

export const useStartScan = (args?: MutationHookArgs) => {
    const { options } = args || {};

    return useMutation<StartScanResponse, AxiosError, StartScanArgs, null>({
        mutationFn: (args) => {
            return api.controller.startScan!({
                ...args,
                apiClientProps: { serverId: args.apiClientProps.serverId },
            });
        },
        ...options,
    });
};
