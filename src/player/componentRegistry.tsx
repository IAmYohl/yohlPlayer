import React from 'react';
import type { WidgetType } from './types';
import { AdvancedPlayerCardWidget } from '../layoutComponents/AdvancedPlayerCardWidget';
import { CoverArtWidget } from '../layoutComponents/CoverArtWidget';
import { MediaViewerWidget } from '../layoutComponents/MediaViewerWidget';
import { PlaylistQueueWidget } from '../layoutComponents/PlaylistQueueWidget';
import { SpectrogramWidget } from '../layoutComponents/SpectrogramWidget';
import { WaveformWidget } from '../layoutComponents/WaveformWidget';

export const COMPONENT_REGISTRY: Record<WidgetType, React.FC<any>> = {
  MEDIA_VIEWER: MediaViewerWidget,
  COVER_ART: CoverArtWidget,
  ADVANCED_PLAYER_CARD: AdvancedPlayerCardWidget,
  WAVEFORM: WaveformWidget,
  SPECTROGRAM: SpectrogramWidget,
  PLAYLIST_QUEUE: PlaylistQueueWidget,
};