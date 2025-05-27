interface JsonPreviewProps {
    value: Record<string, any> | string;
}

export const JsonPreview = ({ value }: JsonPreviewProps) => {
    return <pre style={{ userSelect: 'all' }}>{JSON.stringify(value, null, 2)}</pre>;
};
