// Supported widget type identifier keys
export type WidgetType = 
  | 'MEDIA_VIEWER'
  | 'COVER_ART'
  | 'ADVANCED_PLAYER_CARD'
  | 'WAVEFORM'
  | 'SPECTROGRAM'
  | 'PLAYLIST_QUEUE';

// Individual widget metadata & position config
export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  grid: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  props?: Record<string, any>; // Custom widget-specific settings
}

// Complete layout schema state
export interface LayoutSchema {
  id: string;
  name: string;
  widgets: WidgetConfig[];
}

export interface ArtworkImage {
  mimeType: string;
  pictureType: number;
  pictureTypeName: string;
  description: string;
  data: Uint8Array;
}

// Track metadata for audio files
export interface Track {
  id: string;
  name: string;
  artist: string;
  artwork: ArtworkImage[];
  file: File;
  url: string;
}