import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { Track } from './types';
import {
  parseId3v2Metadata,
  parseId3v1Metadata,
  extractArtworkUrls,
  HEADER_SIZE,
  type ArtworkUrls,
} from './id3Metadata';

interface LibraryContextValue {
  tracks: Track[];
  currentTrack: Track | null;
  isDirectoryPickerSupported: boolean;
  isPlaying: boolean;
  isShuffleEnabled: boolean;
  isLoopEnabled: boolean;
  selectDirectory: () => Promise<void>;
  playTrack: (track: Track) => void;
  playPause: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  toggleShuffle: () => void;
  toggleLoop: () => void;
  getArtworkForTrack: (track: Track) => Promise<ArtworkUrls>;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const artworkCacheRef = useRef<Map<string, ArtworkUrls>>(new Map());

  const isDirectoryPickerSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const revokeTrackUrls = useCallback((trackList: Track[]) => {
    trackList.forEach((track) => {
      if (track.url?.startsWith('blob:')) {
        URL.revokeObjectURL(track.url);
      }
    });
  }, []);

  // Cover art blob URLs are cached separately from track URLs since a track can
  // have up to four of them (front/back/disc/icon) plus any "other" images.
  const revokeArtworkUrls = useCallback(() => {
    artworkCacheRef.current.forEach(({ front, back, disc, icon, other }) => {
      [front, back, disc, icon, ...other].forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    });
    artworkCacheRef.current.clear();
  }, []);

  // Lazily resolves and caches front/back/disc/icon artwork for a track. Reuses
  // the header slice already read during the scan where possible, so this is
  // effectively free for the vast majority of files - see id3Metadata.ts.
  const getArtworkForTrack = useCallback(async (track: Track): Promise<ArtworkUrls> => {
    const cached = artworkCacheRef.current.get(track.id);
    if (cached) {
      return cached;
    }

    const urls = await extractArtworkUrls(track.file);
    artworkCacheRef.current.set(track.id, urls);
    return urls;
  }, []);

  const selectDirectory = useCallback(async () => {
    if (!isDirectoryPickerSupported) {
      alert("Your browser doesn't support folder selection yet — try Chrome or Edge.");
      return;
    }

    try {
      // @ts-ignore - showDirectoryPicker isn't in TS's lib.dom.d.ts yet
      const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker();
      const found: Track[] = [];

      function parseTrackParts(fileName: string) {
        const stem = fileName.replace(/\.mp3$/i, '');
        const dashMatch = stem.match(/^(.+?)\s*[-–—]\s*(.+)$/);

        if (dashMatch) {
          return {
            artist: dashMatch[1].trim() || 'Unknown Artist',
            name: dashMatch[2].trim() || stem,
          };
        }

        return {
          artist: 'Unknown Artist',
          name: stem,
        };
      }

      async function scanDirectoriesForMp3s(handle: any) {
        for await (const [name, entry] of handle.entries()) {
          if (entry.kind === 'file' && name.toLowerCase().endsWith('.mp3')) {
            const file: File = await entry.getFile();

            const FOOTER_SIZE = 128; // ID3v1 tag, always the last 128 bytes

            const headerSlice = file.slice(0, HEADER_SIZE);
            const footerSlice = file.slice(-FOOTER_SIZE);

            const [headerBuffer, footerBuffer] = await Promise.all([
              headerSlice.arrayBuffer(),
              footerSlice.arrayBuffer(),
            ]);

            const id3v2 = parseId3v2Metadata(headerBuffer);
            const id3v1 = parseId3v1Metadata(footerBuffer);
            const metadata = id3v2 ?? id3v1 ?? null;
            const parsed = parseTrackParts(name);
            const title = metadata?.title || parsed.name;
            const artist = metadata?.artist || parsed.artist;

            found.push({
              id: `${name}-${file.lastModified}-${file.size}`,
              name: title,
              artist,
              artwork: [],
              file,
              url: URL.createObjectURL(file),
            });
          } else if (entry.kind === 'directory') {
            await scanDirectoriesForMp3s(entry);
          }
        }
      }

      await scanDirectoriesForMp3s(dirHandle);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
      revokeTrackUrls(tracks);
      revokeArtworkUrls();
      setCurrentTrack(null);
      setIsPlaying(false);
      setTracks(found);

    } catch (err) {
      // AbortError just means the user closed the picker - not a real error
      if ((err as Error).name !== 'AbortError') {
        console.error('Failed to read directory', err);
      }
    }
  }, [isDirectoryPickerSupported, tracks, revokeTrackUrls, revokeArtworkUrls]);

  const playTrack = useCallback((track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    if (audioRef.current) {
      const nextUrl = track.url;
      if (audioRef.current.currentSrc !== nextUrl && audioRef.current.src !== nextUrl) {
        audioRef.current.src = nextUrl;
      }
      audioRef.current.play().catch((err) => {
        if (err.name === 'AbortError') {
          console.log('Playback aborted (likely superseded by a newer play request):', err);
        } else {
          console.error('Failed to play track:', err);
        }
      });
    }
  }, []);

  const playPause = useCallback(() => {
    if (!currentTrack) {
      return;
    }

    if (!audioRef.current) {
      setIsPlaying((prev) => !prev);
      return;
    }

    if (audioRef.current.paused) {
      void audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [currentTrack]);

  const nextTrack = useCallback(() => {
    if (tracks.length === 0) {
      return;
    }

    if (!currentTrack) {
      const first = tracks[0];
      playTrack(first);
      return;
    }

    const currentIndex = tracks.findIndex((track) => track.id === currentTrack.id);
    const workingIndex = currentIndex >= 0 ? currentIndex : -1;

    if (isShuffleEnabled) {
      const pool = tracks.filter((track) => track.id !== currentTrack.id);
      const candidate = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : tracks[0];
      playTrack(candidate);
      return;
    }

    const step = workingIndex >= 0 ? workingIndex + 1 : 0;
    const nextIndex = isLoopEnabled && currentIndex === tracks.length - 1 ? 0 : step % tracks.length;
    const next = tracks[nextIndex] ?? tracks[0];
    playTrack(next);
  }, [currentTrack, isLoopEnabled, isShuffleEnabled, playTrack, tracks]);

  const previousTrack = useCallback(() => {
    if (tracks.length === 0) {
      return;
    }

    if (!currentTrack) {
      const first = tracks[0];
      playTrack(first);
      return;
    }

    const currentIndex = tracks.findIndex((track) => track.id === currentTrack.id);

    if (isShuffleEnabled) {
      const pool = tracks.filter((track) => track.id !== currentTrack.id);
      const candidate = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : tracks[0];
      playTrack(candidate);
      return;
    }

    const previousIndex = currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1;
    const previous = tracks[previousIndex] ?? tracks[0];
    playTrack(previous);
  }, [currentTrack, isShuffleEnabled, playTrack, tracks]);

  const toggleShuffle = useCallback(() => {
    setIsShuffleEnabled((prev) => !prev);
  }, []);

  const toggleLoop = useCallback(() => {
    setIsLoopEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLoopEnabled;
    }
  }, [isLoopEnabled]);

  return (
    <LibraryContext.Provider value={{
      tracks,
      currentTrack,
      isDirectoryPickerSupported,
      isPlaying,
      isShuffleEnabled,
      isLoopEnabled,
      selectDirectory,
      playTrack,
      playPause,
      nextTrack,
      previousTrack,
      toggleShuffle,
      toggleLoop,
      getArtworkForTrack,
    }}>
      {children}
      <audio
        ref={audioRef}
        loop={isLoopEnabled}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          if (isLoopEnabled) {
            setIsPlaying(true);
            if (audioRef.current) {
              void audioRef.current.play();
            }
          } else {
            nextTrack();
          }
        }}
        className="now-playing-audio"
      />
    </LibraryContext.Provider>
  );
};

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within a LibraryProvider');
  return ctx;
}