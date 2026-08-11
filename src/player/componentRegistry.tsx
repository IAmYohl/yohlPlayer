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

const AdvancedPlayerCardWidget: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isShuffleEnabled,
    isLoopEnabled,
    playPause,
    nextTrack,
    previousTrack,
    toggleShuffle,
    toggleLoop,
  } = useLibrary();
  const artSrc = getArtworkDataUrl(currentTrack);

  return (
    <div className="now-playing is-playing" id="nowPlaying">
      <div className="np-art">
        {artSrc ? (
          <img className="np-art-image" src={artSrc} alt="" aria-hidden="true" />
        ) : (
          <>
            <div className="art-fill" aria-hidden="true" />
            <div className="art-grain" aria-hidden="true" />
            <div className="np-pulse" aria-hidden="true" />
          </>
        )}
      </div>
      <div className="np-meta">
        <div className="np-title" id="npTitle">{currentTrack?.name ?? 'No track selected'}</div>
        <div className="np-artist" id="npArtist">{currentTrack?.artist ?? 'Unknown Artist'}</div>
      </div>
      <div className="np-waveform" id="npWave">
        {Array.from({ length: 34 }, (_, index) => (
          <span key={index} className={index < 12 ? 'played' : ''} style={{ height: `${34 + ((index * 43) % 76)}%` }} />
        ))}
      </div>
      <div className="np-scrub">
        <span>2:27</span>
        <div className="bar"><div className="fill" /></div>
        <span>4:53</span>
      </div>
      <div className="transport">
        <button
          className={`tbtn ${isShuffleEnabled ? 'toggled' : ''}`}
          title="Shuffle"
          aria-label="Shuffle"
          aria-pressed={isShuffleEnabled}
          onClick={toggleShuffle}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
        </button>
        <button className="tbtn" title="Previous" aria-label="Previous track" onClick={previousTrack}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zM20 6 9 12l11 6z" />
          </svg>
        </button>
        <button className="tbtn primary" id="playBtn" title="Play/Pause" aria-label="Play or pause" onClick={playPause}>
          <svg viewBox="0 0 24 24" fill="currentColor" id="playIcon">
            {isPlaying ? (
              <>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </>
            ) : (
              <path d="M7 5v14l14-7z" />
            )}
          </svg>
        </button>
        <button className="tbtn" title="Next" aria-label="Next track" onClick={nextTrack}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 6h-2v12h2zM4 6l11 6-11 6z" />
          </svg>
        </button>
        <button
          className={`tbtn ${isLoopEnabled ? 'toggled' : ''}`}
          title="Repeat"
          aria-label="Repeat"
          aria-pressed={isLoopEnabled}
          onClick={toggleLoop}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </button>
      </div>
      <div className="volume-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 5 6 9H2v6h4l5 4V5ZM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
        <div className="bar"><div className="fill" /></div>
      </div>
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
  ADVANCED_PLAYER_CARD: AdvancedPlayerCardWidget,
  WAVEFORM: WaveformWidget,
  SPECTROGRAM: SpectrogramWidget,
  PLAYLIST_QUEUE: PlaylistQueueWidget,
};