import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Track } from './types';

interface LibraryContextValue {
  tracks: Track[];
  currentTrack: Track | null;
  isDirectoryPickerSupported: boolean;
  selectDirectory: () => Promise<void>;
  playTrack: (track: Track) => void;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);

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
            const parsed = parseTrackParts(name);

            found.push({
              id: `${name}-${file.lastModified}-${file.size}`,
              name: parsed.name,
              artist: parsed.artist,
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
  }, []);

  return (
    <LibraryContext.Provider value={{ tracks, currentTrack, isDirectoryPickerSupported, selectDirectory, playTrack }}>
      {children}
    </LibraryContext.Provider>
  );
};

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within a LibraryProvider');
  return ctx;
}