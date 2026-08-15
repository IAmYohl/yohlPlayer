import React from 'react';
import { useTrackArtwork } from '../hooks/useTrackArtwork';
import { useLibrary } from '../player/libraryContext';

export const CoverArtWidget: React.FC = () => {
  const { currentTrack } = useLibrary();
  const artSrc = useTrackArtwork(currentTrack);

  return (
    <div className="widget-body cover-art-widget">
      {currentTrack ? (
        <>
          <div className="cover-art-frame">
            {artSrc ? <img className="cover-art-image" src={artSrc} alt="" /> : <span className="album-art-icon">🎵</span>}
          </div>
          <span className="cover-art-track-name">{currentTrack.name}</span>
          <span className="cover-art-artist-name">{currentTrack.artist}</span>
        </>
      ) : (
        '🖼️ Nothing playing'
      )}
    </div>
  );
};
