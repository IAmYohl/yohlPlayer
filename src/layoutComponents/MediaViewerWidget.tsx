import React from 'react';
import { useLibrary } from '../player/libraryContext';
import { AlbumCard } from './AlbumCard';

export const MediaViewerWidget: React.FC = () => {
  const { tracks, currentTrack, playTrack } = useLibrary();

  if (tracks.length === 0) {
    return <div className="widget-body">📁 No tracks loaded — select a directory to begin</div>;
  }

  return (
    <div className="music-grid">
      {tracks.map((track) => (
        <AlbumCard
          key={track.id}
          track={track}
          isActive={currentTrack?.id === track.id}
          onSelect={() => playTrack(track)}
        />
      ))}
    </div>
  );
};
