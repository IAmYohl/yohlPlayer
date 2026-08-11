import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ArtworkImage, Track } from './types';

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
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

function decodeTextPayload(payload: Uint8Array, encoding: number) {
  if (encoding === 1 || encoding === 2) {
    const bytes = payload;
    const text = new TextDecoder('utf-16').decode(bytes);
    return text.replace(/\u0000+$/g, '').trim();
  }

  if (encoding === 3) {
    const text = new TextDecoder('utf-8').decode(payload);
    return text.replace(/\u0000+$/g, '').trim();
  }

  const text = new TextDecoder('latin1').decode(payload);
  return text.replace(/\u0000+$/g, '').trim();
}

function parseId3v2Metadata(arrayBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.length < 10 || String.fromCharCode(...bytes.slice(0, 3)) !== 'ID3') {
    return null;
  }

  const majorVersion = bytes[3];
  const tagSize = ((bytes[6] & 0x7f) << 21)
    | ((bytes[7] & 0x7f) << 14)
    | ((bytes[8] & 0x7f) << 7)
    | (bytes[9] & 0x7f);

  const headerSize = 10;
  const frameStart = headerSize;
  const frameEnd = Math.min(frameStart + tagSize, bytes.length);

  if (majorVersion < 2 || frameStart >= frameEnd) {
    return null;
  }

  let offset = frameStart;
  let title: string | null = null;
  let artist: string | null = null;

  while (offset + 10 <= frameEnd) {
    const frameIdBytes = bytes.slice(offset, offset + 4);
    const frameId = String.fromCharCode(...frameIdBytes);

    if (frameId === '\u0000\u0000\u0000\u0000') {
      break;
    }

    const frameSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset + 4, false);
    const frameDataStart = offset + 10;
    const frameDataEnd = frameDataStart + frameSize;

    if (frameId === 'TIT2' && frameDataStart + 1 < frameEnd && frameDataEnd <= frameEnd) {
      const framePayload = bytes.slice(frameDataStart, frameDataEnd);
      const encoding = framePayload[0];
      const textBytes = framePayload.slice(1);
      title = decodeTextPayload(textBytes, encoding);
    } else if (frameId === 'TPE1' && frameDataStart + 1 < frameEnd && frameDataEnd <= frameEnd) {
      const framePayload = bytes.slice(frameDataStart, frameDataEnd);
      const encoding = framePayload[0];
      const textBytes = framePayload.slice(1);
      artist = decodeTextPayload(textBytes, encoding);
    }

    offset = frameDataEnd;
  }

  return { title, artist };
}

function parseId3v1Metadata(arrayBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const tagOffset = bytes.length - 128;

  if (tagOffset < 0 || bytes.length < 128) {
    return null;
  }

  if (String.fromCharCode(...bytes.slice(tagOffset, tagOffset + 3)) !== 'TAG') {
    return null;
  }

  const titleBytes = bytes.slice(tagOffset + 3, tagOffset + 33);
  const artistBytes = bytes.slice(tagOffset + 63, tagOffset + 93);

  const title = new TextDecoder('latin1').decode(titleBytes).replace(/\u0000+$/g, '').trim();
  const artist = new TextDecoder('latin1').decode(artistBytes).replace(/\u0000+$/g, '').trim();

  return {
    title: title || null,
    artist: artist || null,
  };
}

const APIC_PICTURE_TYPES: Record<number, string> = {
  0: 'Other',
  1: 'File Icon',
  2: 'Other File Icon',
  3: 'Cover Front',
  4: 'Cover Back',
  5: 'Leaflet',
  6: 'Media',
  7: 'Lead Artist',
  8: 'Artist',
  9: 'Conductor',
  10: 'Band',
  11: 'Composer',
  12: 'Lyricist',
  13: 'Recording Location',
  14: 'Recording Session',
  15: 'Performance',
  16: 'Capture',
  17: 'Illustration',
  18: 'Band Logo',
  19: 'Publisher Logo',
};

export function extractArtworkTypesFromMp3(arrayBuffer: ArrayBuffer): ArtworkImage[] {
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.length < 10 || String.fromCharCode(...bytes.slice(0, 3)) !== 'ID3') {
    return [];
  }

  const tagSize = ((bytes[6] & 0x7f) << 21)
    | ((bytes[7] & 0x7f) << 14)
    | ((bytes[8] & 0x7f) << 7)
    | (bytes[9] & 0x7f);

  const frameStart = 10;
  const frameEnd = Math.min(frameStart + tagSize, bytes.length);
  const artworkImages: ArtworkImage[] = [];

  let offset = frameStart;

  while (offset + 10 <= frameEnd) {
    const frameIdBytes = bytes.slice(offset, offset + 4);
    const frameId = String.fromCharCode(...frameIdBytes);

    if (frameId === '\u0000\u0000\u0000\u0000') {
      break;
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const frameSize = view.getUint32(offset + 4, false);
    const frameDataStart = offset + 10;
    const frameDataEnd = frameDataStart + frameSize;

    if (frameId === 'APIC' && frameDataStart < frameDataEnd && frameDataEnd <= frameEnd) {
      const framePayload = bytes.slice(frameDataStart, frameDataEnd);
      const encoding = framePayload[0];
      const mimeTerminator = framePayload.indexOf(0, 1);

      if (mimeTerminator >= 0) {
        const mimeType = new TextDecoder('latin1').decode(framePayload.slice(1, mimeTerminator));
        let cursor = mimeTerminator + 1;

        if (cursor < framePayload.length) {
          const pictureType = framePayload[cursor];
          cursor += 1;

          const descriptionStart = cursor;
          const descriptionTerminator = encoding === 1 || encoding === 2
            ? framePayload.indexOf(0x00, descriptionStart + 1) // oversimplified UTF-16/16-bit null scan
            : framePayload.indexOf(0, descriptionStart);

          const descriptionBytes = descriptionTerminator >= 0
            ? framePayload.slice(descriptionStart, descriptionTerminator)
            : framePayload.slice(descriptionStart);

          const description = encoding === 1 || encoding === 2
            ? new TextDecoder('utf-16').decode(descriptionBytes)
            : new TextDecoder('latin1').decode(descriptionBytes);

          const nextCursor = descriptionTerminator >= 0
            ? descriptionTerminator + (encoding === 1 || encoding === 2 ? 2 : 1)
            : framePayload.length;

          const imageData = framePayload.slice(Math.min(nextCursor, framePayload.length));

          artworkImages.push({
            mimeType,
            pictureType,
            pictureTypeName: APIC_PICTURE_TYPES[pictureType] ?? 'Unknown',
            description: description.replace(/\u0000+$/g, '').trim(),
            data: imageData,
          });
        }
      }
    }

    offset = frameDataEnd;
  }

  return artworkImages;
}

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isDirectoryPickerSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

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

      async function walk(handle: any) {
        for await (const [name, entry] of handle.entries()) {
          if (entry.kind === 'file' && name.toLowerCase().endsWith('.mp3')) {
            const file: File = await entry.getFile();
            const fileBuffer = await file.arrayBuffer();
            const id3v2 = parseId3v2Metadata(fileBuffer);
            const id3v1 = parseId3v1Metadata(fileBuffer);
            const metadata = id3v2 ?? id3v1 ?? null;
            const parsed = parseTrackParts(name);
            const title = metadata?.title || parsed.name;
            const artist = metadata?.artist || parsed.artist;
            const artwork = extractArtworkTypesFromMp3(fileBuffer);

            found.push({
              id: `${name}-${file.lastModified}-${file.size}`,
              name: title,
              artist,
              artwork,
              file,
              url: URL.createObjectURL(file),
            });
          } else if (entry.kind === 'directory') {
            await walk(entry);
          }
        }
      }

      await walk(dirHandle);
      setTracks(found);
    } catch (err) {
      // AbortError just means the user closed the picker - not a real error
      if ((err as Error).name !== 'AbortError') {
        console.error('Failed to read directory', err);
      }
    }
  }, [isDirectoryPickerSupported]);

  const playTrack = useCallback((track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    if (audioRef.current) {
      const nextUrl = track.url;
      if (audioRef.current.currentSrc !== nextUrl && audioRef.current.src !== nextUrl) {
        audioRef.current.src = nextUrl;
      }
      void audioRef.current.play();
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
    }}>
      {children}
      <audio
        ref={audioRef}
        src={currentTrack?.url ?? ''}
        autoPlay={isPlaying}
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