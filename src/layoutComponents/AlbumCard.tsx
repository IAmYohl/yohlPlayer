import React from 'react';
import { useTrackArtwork } from '../hooks/useTrackArtwork';
import type { Track } from '../player/types';

export const AlbumCard: React.FC<{
  track: Track;
  isActive: boolean;
  onSelect: () => void;
}> = ({ track, isActive, onSelect }) => {
  const artSrc = useTrackArtwork(track);

  return (
    <div className={`album-card ${isActive ? 'active' : ''}`} onClick={onSelect}>
      <div className="album-art-wrap">
        {artSrc ? <img className="album-art-image" src={artSrc} alt="" /> : <span className="album-art-icon">🎵</span>}
      </div>
      <div className="track-copy">
        <span className="track-name">{track.name}</span>
        <span className="artist-name">{track.artist}</span>
      </div>
    </div>
  );
};
