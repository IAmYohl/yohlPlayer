// Supported widget type identifier keys
export type WidgetType = 
  | 'MEDIA_VIEWER'
  | 'COVER_ART'
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

// Track metadata for audio files
export interface Track {
  id: string;
  name: string;
  file: File;
  url: string;
}