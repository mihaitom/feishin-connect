import { Text } from '/@/renderer/components/text';
import { SEPARATOR_STRING } from '/@/shared/api/utils';

export const Separator = () => {
    return (
        <Text
            $noSelect
            $secondary
            size="md"
            style={{ display: 'inline-block', padding: '0px 3px' }}
        >
            {SEPARATOR_STRING}
        </Text>
    );
};
