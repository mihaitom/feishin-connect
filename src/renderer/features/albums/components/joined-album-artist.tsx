import { Fragment } from 'react';
import { generatePath, Link } from 'react-router';

import { AppRoute } from '/@/renderer/router/routes';
import { Group } from '/@/shared/components/group/group';
import { Separator } from '/@/shared/components/separator/separator';
import { Text } from '/@/shared/components/text/text';
import { AlbumArtist, RelatedArtist } from '/@/shared/types/domain-types';

interface JoinedAlbumArtistProps {
    albumArtist: string;
    albumArtists: AlbumArtist[] | RelatedArtist[];
}

export const JoinedAlbumArtist = ({ albumArtist, albumArtists }: JoinedAlbumArtistProps) => {
    const parts: (
        | string
        | { artist: AlbumArtist | RelatedArtist; end: number; start: number; text: string }
    )[] = [];
    const matches: Array<{
        artist: AlbumArtist | RelatedArtist;
        end: number;
        name: string;
        start: number;
    }> = [];

    for (const artist of albumArtists) {
        const name = artist.name;
        const regex = new RegExp(escapeRegex(name), 'gi');
        let match: null | RegExpExecArray = null;
        while ((match = regex.exec(albumArtist)) !== null) {
            matches.push({
                artist,
                end: match.index + match[0].length,
                name: match[0],
                start: match.index,
            });
        }
    }

    matches.sort((a, b) => {
        const lengthDiff = b.end - b.start - (a.end - a.start);
        if (lengthDiff !== 0) return lengthDiff;
        return a.start - b.start;
    });

    const nonOverlappingMatches: typeof matches = [];
    for (const match of matches) {
        const overlaps = nonOverlappingMatches.some(
            (existing) =>
                (match.start >= existing.start && match.start < existing.end) ||
                (match.end > existing.start && match.end <= existing.end) ||
                (match.start <= existing.start && match.end >= existing.end),
        );

        if (!overlaps) {
            nonOverlappingMatches.push(match);
        }
    }

    nonOverlappingMatches.sort((a, b) => a.start - b.start);

    let lastIndex = 0;
    for (const match of nonOverlappingMatches) {
        if (match.start > lastIndex) {
            parts.push(albumArtist.substring(lastIndex, match.start));
        }

        parts.push({
            artist: match.artist,
            end: match.end,
            start: match.start,
            text: match.name,
        });

        lastIndex = match.end;
    }

    if (lastIndex < albumArtist.length) {
        parts.push(albumArtist.substring(lastIndex));
    }

    const hasArtistMatches = parts.some((part) => typeof part !== 'string');

    // If no matches found and there are album artists, return the album artists
    if (!hasArtistMatches && albumArtists.length > 0) {
        return (
            <Group gap="xs">
                {albumArtists.map((artist, index) => (
                    <Fragment key={artist.id}>
                        {index > 0 && <Separator />}
                        <Text
                            component={Link}
                            fw={600}
                            isLink
                            to={generatePath(AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL, {
                                albumArtistId: artist.id,
                            })}
                        >
                            {artist.name}
                        </Text>
                    </Fragment>
                ))}
            </Group>
        );
    }

    // If no matches found and no albumArtists, return the original string
    if (!hasArtistMatches) {
        return (
            <Text fw={400} isNoSelect>
                {albumArtist}
            </Text>
        );
    }

    return (
        <Text component="span" fw={400}>
            {parts.map((part, index) => {
                if (typeof part === 'string') {
                    return <Fragment key={index}>{part}</Fragment>;
                }

                const { artist, text } = part;
                return (
                    <Text
                        component={Link}
                        fw={600}
                        isLink
                        key={`${artist.id}-${index}`}
                        to={generatePath(AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL, {
                            albumArtistId: artist.id,
                        })}
                    >
                        {text}
                    </Text>
                );
            })}
        </Text>
    );
};

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
