import styles from './json-preview.module.css';

interface JsonPreviewProps {
    value: Record<string, any> | string;
}

export const JsonPreview = ({ value }: JsonPreviewProps) => {
    return (
        <pre className={styles.preview} style={{ userSelect: 'all' }}>
            {JSON.stringify(value, null, 4)}
        </pre>
    );
};
