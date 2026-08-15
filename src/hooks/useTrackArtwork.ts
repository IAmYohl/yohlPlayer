import { useEffect, useState } from 'react';
import { useLibrary } from '../player/libraryContext';
import type { Track } from '../player/types';

// Resolves and caches a track's cover art as a blob URL via context. Falls
// back through front -> back -> disc -> icon -> any other embedded image.
export function useTrackArtwork(track: Track | null | undefined): string | undefined {
  const { getArtworkForTrack } = useLibrary();
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!track) {
      setArtworkUrl(undefined);
      return;
    }

    let cancelled = false;
    setArtworkUrl(undefined);

    getArtworkForTrack(track).then((urls) => {
      if (!cancelled) {
        setArtworkUrl(urls.front ?? urls.back ?? urls.disc ?? urls.icon ?? urls.other[0]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [track?.id, getArtworkForTrack]);

  return artworkUrl;
}
