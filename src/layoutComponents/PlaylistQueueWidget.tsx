import React from 'react';
import { useLibrary } from '../player/libraryContext';

export const PlaylistQueueWidget: React.FC = () => {
  const { tracks, currentTrack, playTrack } = useLibrary();

  if (tracks.length === 0) {
    return <div className="widget-body">📜 Queue is empty</div>;
  }

  return (
    <div className="queue-widget">
      {tracks.map((track) => (
        <div
          key={track.id}
          className={`queue-item ${currentTrack?.id === track.id ? 'active' : ''}`}
          onClick={() => playTrack(track)}
        >
          {track.name}
        </div>
      ))}
    </div>
  );
};
