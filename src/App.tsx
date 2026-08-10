import { useState } from 'react';
import { DynamicCanvas } from './player/dynamicCanvas';
import type { LayoutSchema, WidgetConfig, WidgetType } from './player/types';
import { useLibrary } from './player/libraryContext';
import './App.scss';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const INITIAL_LAYOUT: LayoutSchema = {
  id: 'default-layout',
  name: 'Default Player View',
  widgets: [
    { id: 'cover-art-1', type: 'COVER_ART', title: 'Now Playing Art', grid: { x: 0, y: 0, w: 3, h: 4 } },
    { id: 'waveform-1', type: 'WAVEFORM', title: 'Audio Waveform', grid: { x: 0, y: 4, w: 3, h: 2 } },
    { id: 'queue-1', type: 'PLAYLIST_QUEUE', title: 'Playlist Queue', grid: { x: 0, y: 6, w: 3, h: 6 } },
    { id: 'media-viewer-main', type: 'MEDIA_VIEWER', title: 'Media Viewer', grid: { x: 3, y: 0, w: 9, h: 12 } },
  ],
};

const PALETTE: { type: WidgetType; label: string; blurb: string; icon: string }[] = [
  { type: 'MEDIA_VIEWER', label: 'Media Viewer (Grid)', blurb: 'Album art grid view of directory files', icon: '🖼️' },
  { type: 'SPECTROGRAM', label: 'FFT Spectrogram', blurb: 'Real-time frequency visualizer canvas', icon: '📊' },
  { type: 'WAVEFORM', label: 'Audio Waveform', blurb: 'Interactive audio seek scrubber', icon: '〰️' },
  { type: 'COVER_ART', label: 'Cover Art Display', blurb: 'Currently playing album graphic', icon: '🖼️' },
  { type: 'PLAYLIST_QUEUE', label: 'Playlist Queue', blurb: 'Upcoming tracks list', icon: '📜' },
];

export function App() {
  const { tracks, currentTrack, selectDirectory } = useLibrary();
  const [layout, setLayout] = useState<LayoutSchema>(INITIAL_LAYOUT);
  const [isEditing, setIsEditing] = useState(false);
  const [isCinematic, setIsCinematic] = useState(false);

  const handleRemoveWidget = (widgetId: string) => {
    setLayout((prev) => ({ ...prev, widgets: prev.widgets.filter((w) => w.id !== widgetId) }));
  };

  const handleLayoutChange = (newWidgets: LayoutSchema['widgets']) => {
    setLayout((prev) => ({ ...prev, widgets: newWidgets }));
  };

  const handleAddWidget = (type: WidgetType) => {
    const newWidget: WidgetConfig = {
      id: `${type.toLowerCase()}-${Date.now()}`,
      type,
      title: type.replace('_', ' '),
      grid: { x: 0, y: Infinity, w: 3, h: 3 },
    };
    setLayout((prev) => ({ ...prev, widgets: [...prev.widgets, newWidget] }));
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layout.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`app-shell ${isCinematic ? 'cinematic' : ''}`}>
      {/* Left Primary Rail Navigation */}
      <nav className="nav-rail">
        <button
          className={`rail-btn ${!isEditing ? 'active' : ''}`}
          title="MP3 Player View"
          onClick={() => setIsEditing(false)}
        >
          🎵
        </button>
        <button
          className={`rail-btn ${isEditing ? 'active' : ''}`}
          title="Live Layout Editor"
          onClick={() => setIsEditing(true)}
        >
          🛠️
        </button>
        <button
          className={`rail-btn ${isCinematic ? 'active' : ''}`}
          title="Cinematic Mode"
          onClick={() => setIsCinematic(!isCinematic)}
        >
          🎬
        </button>
      </nav>

      {/* Live Editor Component Drawer */}
      <aside className={`editor-drawer ${isEditing ? '' : 'collapsed'}`}>
        <div className="drawer-header">
          <h3>🛠️ Layout Components</h3>
          <p>Add components to your player UI grid.</p>
        </div>

        <div className="widget-palette">
          {PALETTE.map((item) => (
            <div key={item.type} className="palette-card" onClick={() => handleAddWidget(item.type)}>
              <div>
                <strong>{item.icon} {item.label}</strong>
                <small>{item.blurb}</small>
              </div>
            </div>
          ))}
        </div>

        <div className="drawer-footer">
          <button className="btn-action primary" onClick={exportJSON}>
            💾 Export Layout JSON
          </button>
        </div>
      </aside>

      {/* Main Application Wrapper */}
      <div className="main-wrapper">
        {!isCinematic && (
          <div className="menu-bar">
            <span className="menu-item">File</span>
            <span className="menu-item">Edit</span>
            <span className="menu-item">View</span>
            <span className="menu-item">Playback</span>
            <span className="menu-item">Library</span>
          </div>
        )}

        {isEditing && (
          <div className="editor-banner">
            <span>⚠️ LIVE LAYOUT EDITOR — Drag, resize, or remove widget headers</span>
            <button className="btn-action" style={{ width: 'auto', padding: '2px 8px' }} onClick={() => setIsEditing(false)}>
              Done Editing
            </button>
          </div>
        )}

        {!isCinematic && (
          <div className="toolbar">
            <button className="file-input-btn" onClick={selectDirectory}>
              📁 Select Directory
            </button>
            {tracks.length > 0 && <span className="track-count">{tracks.length} tracks loaded</span>}
          </div>
        )}

        <div className="app-body">
          <DynamicCanvas
            layout={layout}
            isEditing={isEditing}
            onRemoveWidget={handleRemoveWidget}
            onLayoutChange={handleLayoutChange}
          />
        </div>

        {!isCinematic && (
          <footer className="status-bar">
            <span>Mode: <strong>{isEditing ? 'Live Layout Editor Active' : 'Playback Mode'}</strong></span>
            <span>MP3 | 192 kbps | 48000 Hz</span>
          </footer>
        )}
      </div>
      {currentTrack && <audio src={currentTrack.url} controls autoPlay className="now-playing-audio" />}
    </div>
  );
}

export default App;