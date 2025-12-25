
import React, { useState } from 'react';
import { ToolType } from '../types';
import * as Icons from './Icons';

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  toggleSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleSettings: () => void;
  showExact: boolean;
  toggleExact: () => void;
  onZoomText: (delta: number) => void;
  precision: number;
  onUpdatePrecision: (delta: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  rightSidebarOpen: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  activeTool, onSelectTool, toggleSidebar, toggleRightSidebar, toggleSettings, 
  showExact, toggleExact, onZoomText, precision, onUpdatePrecision, 
  onUndo, onRedo, canUndo, canRedo, rightSidebarOpen 
}) => {
  const [showPointsMenu, setShowPointsMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showLinesMenu, setShowLinesMenu] = useState(false);

  const handleToolClick = (tool: ToolType) => {
    onSelectTool(tool);
    setShowPointsMenu(false);
    setShowToolsMenu(false);
    setShowLinesMenu(false);
  };

  return (
    <div className="h-14 border-b flex items-center px-4 gap-2 bg-white shadow-sm z-20 relative select-none">
      <div 
        className="font-bold text-xl mr-4 text-[#F57C00] flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={toggleSidebar}
        title="Toggle Sidebar"
      >
        <span>ƒ</span>
        <span className="hidden sm:inline">Graph Calc</span>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-2">
        <button 
            onClick={onUndo} 
            disabled={!canUndo}
            className={`p-2 rounded transition-colors ${canUndo ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-default'}`}
            title="Undo (Ctrl+Z)"
        >
            <Icons.IconUndo />
        </button>
        <button 
            onClick={onRedo} 
            disabled={!canRedo}
            className={`p-2 rounded transition-colors ${canRedo ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-default'}`}
            title="Redo (Ctrl+Y)"
        >
            <Icons.IconRedo />
        </button>
      </div>

      <ToolButton tool="move" title="Move" active={activeTool} onClick={handleToolClick} icon={<Icons.IconMove />} />
      
      <div className="relative">
        <button 
          onClick={() => { setShowPointsMenu(!showPointsMenu); setShowToolsMenu(false); setShowLinesMenu(false); }}
          className={`p-2 rounded hover:bg-gray-100 ${showPointsMenu || ['freePoint', 'pointOn', 'intersectObjects'].includes(activeTool) ? 'bg-gray-200' : ''}`}
          title="Point Tools"
        >
          <Icons.IconPoint />
        </button>
        {showPointsMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-30 flex flex-col gap-1 min-w-[210px]">
             {[
               { id: 'freePoint', icon: <Icons.IconPoint />, label: 'Free Point' },
               { id: 'intersectObjects', icon: <Icons.IconIntersectObjects />, label: 'Intersect Objects' },
               { id: 'pointOn', icon: <Icons.IconPointOn />, label: 'Point on Object' }
             ].map((t: any) => (
               <MenuButton key={t.id} onClick={() => handleToolClick(t.id)} icon={t.icon} label={t.label} active={activeTool === t.id} />
             ))}
          </div>
        )}
      </div>

      <ToolButton tool="polygon" title="Polygon" active={activeTool} onClick={handleToolClick} icon={<Icons.IconPolygon />} />

      <div className="relative">
        <button 
          onClick={() => { setShowToolsMenu(!showToolsMenu); setShowLinesMenu(false); setShowPointsMenu(false); }}
          className={`p-2 rounded hover:bg-gray-100 ${showToolsMenu ? 'bg-gray-200' : ''}`}
          title="Function Tools"
        >
          <Icons.IconTools />
        </button>
        {showToolsMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-30 flex flex-col gap-1 min-w-[180px]">
             {[
               { id: 'zeros', icon: <Icons.IconZeros />, label: 'Roots' },
               { id: 'max', icon: <Icons.IconMax />, label: 'Extrema (Max)' },
               { id: 'min', icon: <Icons.IconMin />, label: 'Extrema (Min)' },
               { id: 'intersect', icon: <Icons.IconIntersect />, label: 'Exact Intersection' }
             ].map((t: any) => (
               <MenuButton key={t.id} onClick={() => handleToolClick(t.id)} icon={t.icon} label={t.label} active={activeTool === t.id} />
             ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button 
          onClick={() => { setShowLinesMenu(!showLinesMenu); setShowToolsMenu(false); setShowPointsMenu(false); }}
          className={`p-2 rounded hover:bg-gray-100 ${showLinesMenu ? 'bg-gray-200' : ''}`}
          title="Lines & Curves"
        >
          <Icons.IconLine />
        </button>
        {showLinesMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-30 flex flex-col gap-1 min-w-[170px]">
            {[
              { id: 'line', icon: <Icons.IconLine />, label: 'Line' },
              { id: 'segment', icon: <Icons.IconSegment />, label: 'Segment' },
              { id: 'ray', icon: <Icons.IconRay />, label: 'Ray' },
              { id: 'tangent', icon: <Icons.IconTangent />, label: 'Tangent' }
            ].map((t: any) => (
              <MenuButton key={t.id} onClick={() => handleToolClick(t.id)} icon={t.icon} label={t.label} active={activeTool === t.id} />
            ))}
          </div>
        )}
      </div>

      <ToolButton tool="eraser" title="Erase" active={activeTool} onClick={handleToolClick} icon={<Icons.IconEraser />} className="text-red-600 hover:bg-red-50" activeClassName="bg-red-100 text-red-700" />

      <div className="flex-1" />

      <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-2">
         <span className="text-xs font-bold text-gray-500 uppercase mr-1">Decimals:</span>
         <button onClick={() => onUpdatePrecision(-1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 font-bold w-7 h-7 flex items-center justify-center border border-transparent hover:border-gray-200" title="Decrease Precision">-</button>
         <span className="text-xs font-mono w-4 text-center select-none">{precision}</span>
         <button onClick={() => onUpdatePrecision(1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 font-bold w-7 h-7 flex items-center justify-center border border-transparent hover:border-gray-200" title="Increase Precision">+</button>
      </div>

      <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-2">
         <span className="text-xs font-bold text-gray-500 uppercase mr-1">Text:</span>
         <button onClick={() => onZoomText(-1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 font-bold w-7 h-7 flex items-center justify-center border border-transparent hover:border-gray-200" title="Smaller Text">-</button>
         <button onClick={() => onZoomText(1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 font-bold w-7 h-7 flex items-center justify-center border border-transparent hover:border-gray-200" title="Larger Text">+</button>
      </div>

      {activeTool === 'polygon' && (
        <div className="hidden md:block text-xs bg-indigo-600 text-white px-3 py-1 rounded-full animate-pulse mr-2">
          Click to add vertices. Click start point to close.
        </div>
      )}

      <button 
        onClick={toggleExact}
        className={`p-2 rounded font-bold border w-10 h-10 flex items-center justify-center transition-colors ${showExact ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
        title={showExact ? "Exact Values (CAS)" : "Decimal Values"}
      >
        {showExact ? "=" : "≈"}
      </button>

      <button 
        onClick={toggleRightSidebar}
        className={`p-2 rounded transition-colors ${rightSidebarOpen ? 'bg-[#E0F2F1] text-[#007888] shadow-inner' : 'hover:bg-gray-100 text-gray-600'}`}
        title="AI Assistant"
      >
        <Icons.IconSparkles />
      </button>

      <button onClick={toggleSettings} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Settings">
        <Icons.IconSettings />
      </button>
      <button onClick={toggleSidebar} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Sidebar">
        <Icons.IconMenu />
      </button>
    </div>
  );
};

const ToolButton = ({ tool, active, onClick, icon, title, className = "", activeClassName = "bg-indigo-100 text-indigo-700" }: any) => (
  <button 
    onClick={() => onClick(tool)} 
    className={`p-2 rounded transition-colors ${active === tool ? activeClassName : 'hover:bg-gray-100 text-gray-600'} ${className}`}
    title={title || tool}
  >
    {icon}
  </button>
);

const MenuButton = ({ onClick, icon, label, active }: any) => (
  <button 
    onClick={onClick} 
    className={`p-2 rounded flex items-center gap-3 text-sm font-medium text-left w-full ${active ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
  >
    {icon} <span>{label}</span>
  </button>
);

export default Toolbar;
