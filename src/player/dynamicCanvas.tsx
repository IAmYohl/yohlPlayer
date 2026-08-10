import React from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { LayoutSchema } from './types';
import { WidgetShell } from './widgetShell';

export interface CanvasLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isDraggable?: boolean;
  isResizable?: boolean;
}

const ResponsiveGrid = WidthProvider(GridLayout) as React.ComponentType<any>;

interface DynamicCanvasProps {
  layout: LayoutSchema;
  isEditing: boolean;
  showGridBackground: boolean;
  onRemoveWidget: (id: string) => void;
  onLayoutChange: (newWidgets: LayoutSchema['widgets']) => void;
}

export const DynamicCanvas: React.FC<DynamicCanvasProps> = ({
  layout,
  isEditing,
  showGridBackground,
  onRemoveWidget,
  onLayoutChange,
}) => {
  const gridLayout: CanvasLayoutItem[] = layout.widgets.map((widget) => ({
    i: widget.id,
    x: widget.grid.x,
    y: widget.grid.y,
    w: widget.grid.w,
    h: widget.grid.h,
    isDraggable: isEditing,
    isResizable: isEditing,
  }));

  const handleGridChange = (newLayout: CanvasLayoutItem[]) => {
    if (!isEditing) return;

    const updatedWidgets = layout.widgets.map((widget) => {
      const match = newLayout.find((item) => item.i === widget.id);
      if (match) {
        return {
          ...widget,
          grid: { x: match.x, y: match.y, w: match.w, h: match.h },
        };
      }
      return widget;
    });

    onLayoutChange(updatedWidgets);
  };

  return (
    <div className={`dynamic-canvas ${isEditing || showGridBackground ? 'canvas-grid-bg' : ''}`}>
      <ResponsiveGrid
        className="layout"
        layout={gridLayout}
        cols={12}
        rowHeight={60}
        isDraggable={isEditing}
        isResizable={isEditing}
        onLayoutChange={handleGridChange}
      >
        {layout.widgets.map((widget) => (
          <div key={widget.id}>
            <WidgetShell
              widget={widget}
              isEditing={isEditing}
              onRemoveWidget={onRemoveWidget}
            />
          </div>
        ))}
      </ResponsiveGrid>
    </div>
  );
};