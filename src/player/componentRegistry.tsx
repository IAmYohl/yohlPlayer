import React from 'react';
import type { WidgetType } from './types';
import { useLibrary } from './libraryContext';

const MediaViewerWidget: React.FC = () => {
  const { tracks, currentTrack, playTrack } = useLibrary();

  if (tracks.length === 0) {
    return <div className="widget-body">📁 No tracks loaded — select a directory to begin</div>;
  }

  return (
    <div className="music-grid">
      {tracks.map((track) => (
        <div
          key={track.id}
          className={`album-card ${currentTrack?.id === track.id ? 'active' : ''}`}
          onClick={() => playTrack(track)}
        >
          <div className="album-art-wrap">🎵</div>
          <div className="track-copy">
            <span className="track-name">{track.name}</span>
            <span className="artist-name">{track.artist}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const CoverArtWidget: React.FC = () => {
  const { currentTrack } = useLibrary();
  return (
    <div className="widget-body">
      {currentTrack ? `🖼️ ${currentTrack.name}` : '🖼️ Nothing playing'}
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