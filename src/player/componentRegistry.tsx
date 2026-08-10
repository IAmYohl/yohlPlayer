import React from 'react';
import type { Track, WidgetType } from './types';
import { useLibrary } from './libraryContext';

function getArtworkDataUrl(track: Track | null | undefined) {
  if (!track?.artwork?.length) {
    return undefined;
  }

  const coverArtwork = track.artwork.find((image) => image.pictureType === 3)
    ?? track.artwork.find((image) => image.pictureType === 4)
    ?? track.artwork[0];

  if (!coverArtwork || coverArtwork.data.length === 0) {
    return undefined;
  }

  let binary = '';
  const bytes = coverArtwork.data;

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return `data:${coverArtwork.mimeType || 'image/jpeg'};base64,${btoa(binary)}`;
}

const MediaViewerWidget: React.FC = () => {
  const { tracks, currentTrack, playTrack } = useLibrary();

  if (tracks.length === 0) {
    return <div className="widget-body">📁 No tracks loaded — select a directory to begin</div>;
  }

  return (
    <div className="music-grid">
      {tracks.map((track) => {
        const artSrc = getArtworkDataUrl(track);

        return (
          <div
            key={track.id}
            className={`album-card ${currentTrack?.id === track.id ? 'active' : ''}`}
            onClick={() => playTrack(track)}
          >
            <div className="album-art-wrap">
              {artSrc ? <img className="album-art-image" src={artSrc} alt="" /> : <span className="album-art-icon">🎵</span>}
            </div>
            <div className="track-copy">
              <span className="track-name">{track.name}</span>
              <span className="artist-name">{track.artist}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CoverArtWidget: React.FC = () => {
  const { currentTrack } = useLibrary();
  const artSrc = getArtworkDataUrl(currentTrack);

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

const WaveformWidget = () => <div className="widget-body">〰️ Waveform Visualizer</div>;
const SpectrogramWidget = () => <div className="widget-body">📊 FFT Spectrogram Canvas</div>;

const PlaylistQueueWidget: React.FC = () => {
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

export const COMPONENT_REGISTRY: Record<WidgetType, React.FC<any>> = {
  MEDIA_VIEWER: MediaViewerWidget,
  COVER_ART: CoverArtWidget,
  WAVEFORM: WaveformWidget,
  SPECTROGRAM: SpectrogramWidget,
  PLAYLIST_QUEUE: PlaylistQueueWidget,
};