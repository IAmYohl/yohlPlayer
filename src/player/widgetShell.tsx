import React from 'react';
import type { WidgetConfig } from './types';
import { COMPONENT_REGISTRY } from './componentRegistry';

interface WidgetShellProps {
  widget: WidgetConfig;
  isEditing: boolean;
  onRemoveWidget: (id: string) => void;
}

export const WidgetShell: React.FC<WidgetShellProps> = ({
  widget,
  isEditing,
  onRemoveWidget,
}) => {
  const InnerComponent = COMPONENT_REGISTRY[widget.type];

  if (!InnerComponent) {
    return <div className="widget-error">Unknown Component: {widget.type}</div>;
  }

  return (
    <div className={`widget-shell ${isEditing ? 'editing-active' : ''}`} data-id={widget.id}>
      {isEditing && (
        <div className="widget-header-overlay">
          <span className="widget-title">{widget.title}</span>
          <div className="widget-actions">
            <button 
              className="widget-btn" 
              title="Settings"
              onMouseDown={(e) => e.stopPropagation()}
            >
              ⚙️
            </button>
            <button 
              className="widget-btn" 
              title="Remove"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onRemoveWidget(widget.id)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="widget-content">
        <InnerComponent {...widget.props} />
      </div>
    </div>
  );
};