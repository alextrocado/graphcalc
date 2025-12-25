
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import AIAssistant from './components/AIAssistant';
import { MathFunction, MathParam, ViewPort, ToolType, AnalysisObject } from './types';
import { INITIAL_FUNCTIONS, INITIAL_PARAMS, INITIAL_VIEW, COLORS, FUNCTION_NAMES } from './constants';
import { analyzeInputType, parseInputToNumber, parseLineEquation, projectPointOntoLine, preprocessInput, createMathScope, calculateWorldPoints, sanitizeExpression, getObjectsToRemove } from './services/mathUtils';

interface AppState {
  functions: MathFunction[];
  params: MathParam[];
  activeAnalyses: AnalysisObject[];
}

const App: React.FC = () => {
  const [functions, setFunctions] = useState<MathFunction[]>(INITIAL_FUNCTIONS);
  const [params, setParams] = useState<MathParam[]>(INITIAL_PARAMS);
  const [view, setView] = useState<ViewPort>(INITIAL_VIEW);
  const [activeTool, setActiveTool] = useState<ToolType>('move');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(320);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);

  const [activeAnalyses, setActiveAnalyses] = useState<AnalysisObject[]>([]);
  const [polygonBuilder, setPolygonBuilder] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showExact, setShowExact] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [precision, setPrecision] = useState(2);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [history, setHistory] = useState<AppState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
     if (history.length === 0) {
         setHistory([{ functions: INITIAL_FUNCTIONS, params: INITIAL_PARAMS, activeAnalyses: [] }]);
         setHistoryIndex(0);
     }
  }, []);

  const [editingObject, setEditingObject] = useState<{ id: number | string, type: 'function' | 'analysis' } | null>(null);
  const [axisLabels, setAxisLabels] = useState({ x: 'x', y: 'y' });
  const [windowBounds, setWindowBounds] = useState({ xMin: '-10', xMax: '10', yMin: '-10', yMax: '10' });
  const [tempAxisLabels, setTempAxisLabels] = useState({ x: 'x', y: 'y' });

  const updateState = (updates: { functions?: MathFunction[], activeAnalyses?: AnalysisObject[], params?: MathParam[] }, commit = false) => {
      const nextFuncs = updates.functions !== undefined ? updates.functions : functions;
      const nextAnalyses = updates.activeAnalyses !== undefined ? updates.activeAnalyses : activeAnalyses;
      const nextParams = updates.params !== undefined ? updates.params : params;
      if (updates.functions !== undefined) setFunctions(nextFuncs);
      if (updates.activeAnalyses !== undefined) setActiveAnalyses(nextAnalyses);
      if (updates.params !== undefined) setParams(nextParams);
      if (commit) {
          const newState: AppState = { functions: nextFuncs, activeAnalyses: nextAnalyses, params: nextParams };
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(newState);
          if (newHistory.length > 50) newHistory.shift();
          setHistory(newHistory); setHistoryIndex(newHistory.length - 1);
      }
  };

  const handleUndo = () => { if (historyIndex > 0) { const prev = history[historyIndex - 1]; setFunctions(prev.functions); setActiveAnalyses(prev.activeAnalyses); setParams(prev.params); setHistoryIndex(historyIndex - 1); } };
  const handleRedo = () => { if (historyIndex < history.length - 1) { const next = history[historyIndex + 1]; setFunctions(next.functions); setActiveAnalyses(next.activeAnalyses); setParams(next.params); setHistoryIndex(historyIndex + 1); } };
  
  const calculatedPoints = useMemo(() => {
    const halfWidth = (canvasSize.width / 2) / view.scaleX;
    try { return calculateWorldPoints(functions, params, activeAnalyses, precision, { min: view.x - halfWidth * 1.1, max: view.x + halfWidth * 1.1 }); }
    catch (e) { return []; }
  }, [functions, params, activeAnalyses, precision, view, canvasSize]);

  const isSyncingPoints = useRef(false);
  useEffect(() => {
    if (isSyncingPoints.current) return;
    let updatesNeeded = false;
    const updates = new Map<string, number>();
    calculatedPoints.forEach(cp => {
        if (cp.analysisIndex !== undefined) {
            const analysis = activeAnalyses[cp.analysisIndex];
            if (analysis && analysis.type === 'func_analysis' && analysis.x !== undefined && Math.abs(analysis.x - cp.x) > 1e-4) {
                updates.set(String(analysis.id), cp.x); updatesNeeded = true;
            }
        }
    });
    if (updatesNeeded) {
        isSyncingPoints.current = true;
        setActiveAnalyses(prev => prev.map(a => updates.has(String(a.id)) ? { ...a, x: updates.get(String(a.id)) } : a));
        setTimeout(() => { isSyncingPoints.current = false; }, 0);
    }
  }, [calculatedPoints, activeAnalyses]); 

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setActiveTool('move'); setPolygonBuilder([]); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) handleRedo(); else handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [historyIndex, history]);

  const removeAnalysis = useCallback((id: string) => {
    const IDsToRemove = getObjectsToRemove(id, activeAnalyses);
    updateState({ activeAnalyses: activeAnalyses.filter(a => !IDsToRemove.includes(String(a.id))) }, true);
    if (editingObject && IDsToRemove.includes(String(editingObject.id))) setEditingObject(null);
  }, [activeAnalyses, editingObject]);

  const getNextColor = (currentFuncs: MathFunction[]) => {
    const used = new Set(currentFuncs.map(f => f.color));
    return COLORS.find(c => !used.has(c)) || COLORS[currentFuncs.length % COLORS.length];
  };

  const checkForNewParams = (expression: string, ignoreList: string[] = []) => {
    if (!expression || !expression.trim()) return;
    try {
        let node = math.parse(expression.includes('=') ? expression.replace(/[=<>]=?/g, '+') : expression);
        const analysisLabels = new Set(activeAnalyses.map(a => a.label).filter(Boolean));
        const candidates = new Set<string>();
        node.traverse((n: any) => { if (n.isSymbolNode) candidates.add(n.name); });
        setParams(prev => {
            const newParams: MathParam[] = [];
            const existing = new Set(prev.map(p => p.name));
            candidates.forEach(sym => {
                if (sym === 'x' || sym === 'y' || functions.some(f => f.name === sym) || existing.has(sym) || ignoreList.includes(sym) || analysisLabels.has(sym)) return;
                if (sym.startsWith('var_') || ['pi', 'e', 'i', 'inf', 'NaN', 'phi'].includes(sym)) return;
                // @ts-ignore
                if (typeof math[sym] === 'function') return;
                newParams.push({ name: sym, value: 1, min: -5, max: 5, step: 0.1 }); 
                existing.add(sym);
            });
            return newParams.length === 0 ? prev : [...prev, ...newParams];
        });
    } catch (e) {}
  };

  const calculateFunctionUpdates = (currentFunctions: MathFunction[], id: number, valRaw: string, applyDisplayTransform: boolean): MathFunction[] => {
      const val = preprocessInput(valRaw);
      const analysis = analyzeInputType(val);
      
      const nextFunctions = currentFunctions.map(f => {
        if (f.id !== id) return f;
        let displayValue = valRaw.replace(/log_/g, 'log');
        
        if (applyDisplayTransform) {
            if (analysis.expr && (analysis.type === 'function' || analysis.type === 'inequality' || analysis.type === 'implicit')) {
                displayValue = analysis.expr;
            }
        }
        
        const cleanExpression = sanitizeExpression(analysis.expr || val);
        return { ...f, inputValue: displayValue, expression: cleanExpression, type: analysis.type, derivedFrom: undefined, derivationType: undefined };
      });

      const updateCascading = (funcs: MathFunction[], parentId: number, parentExpr: string, depth = 0): MathFunction[] => {
          if (depth > 5) return funcs; 
          const children = funcs.filter(f => f.derivedFrom === parentId);
          if (children.length === 0) return funcs;
          let currentFuncs = [...funcs];
          children.forEach(child => {
             try {
                 nerdamer.clear('vars'); 
                 const safeParentExpr = sanitizeExpression(parentExpr);
                 let newExpr = child.expression;
                 if (child.derivationType === 'derivative') newExpr = nerdamer(`diff((${safeParentExpr}), x)`).toString();
                 else if (child.derivationType === 'integral') newExpr = nerdamer(`integrate((${safeParentExpr}), x)`).toString();
                 if (newExpr !== child.expression) {
                     currentFuncs = currentFuncs.map(f => f.id === child.id ? { ...f, expression: newExpr, inputValue: newExpr } : f);
                     currentFuncs = updateCascading(currentFuncs, child.id, newExpr, depth + 1);
                 }
             } catch (e) {}
          });
          return currentFuncs;
      };

      const updatedFunc = nextFunctions.find(f => f.id === id);
      if (updatedFunc && updatedFunc.expression) return updateCascading(nextFunctions, id, updatedFunc.expression);
      return nextFunctions;
  };

  const handleFunctionSubmit = useCallback((id: number, valRaw: string) => {
    const val = preprocessInput(valRaw);
    const analysis = analyzeInputType(val);
    const explicitName = (analysis as any).name;
    checkForNewParams(val, explicitName ? [explicitName] : []);
    updateState({ functions: calculateFunctionUpdates(functions, id, valRaw, true) }, true);
  }, [functions, activeAnalyses, params]);

  const updateFunction = useCallback((id: number, valRaw: string) => {
    setFunctions(prev => {
        const next = calculateFunctionUpdates(prev, id, valRaw, false);
        return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, []);

  const handleGeneralInput = useCallback((v: string) => {
    try {
        const val = preprocessInput(v).trim();
        const analysis = analyzeInputType(val);
        
        const explicitName = (analysis as any).name;
        checkForNewParams(val, explicitName ? [explicitName] : []);

        if (analysis.type === 'geometric_assignment') {
            const { name, prop, targetLabel } = (analysis as any);
            const target = activeAnalyses.find(a => a.label === targetLabel);
            if (!target) return;
            if (prop === 'declive' || prop === 'slope') {
                updateState({ activeAnalyses: [...activeAnalyses.filter(a => a.label !== name), { id: String(Date.now()), type: 'slope_analysis', targetId: String(target.id), label: name, visible: true }] }, true);
                return;
            }
        }

        if (analysis.type === 'point_assignment') {
            const { name, xExpr, yExpr } = (analysis as any);
            updateState({ activeAnalyses: [...activeAnalyses.filter(a => a.label !== name), { id: String(Date.now()), type: 'freePoint', label: name, xExpr, yExpr, color: '#4f46e5', size: 5, visible: true }] }, true);
            return;
        }

        if (analysis.type === 'parameter') {
            const name = (analysis as any).name;
            const expr = (analysis as any).expr;
            const scope = createMathScope(params, calculatedPoints, activeAnalyses, functions);
            let evaluatedValue = 1;
            try {
                const result = math.evaluate(sanitizeExpression(expr), scope);
                if (typeof result === 'number' && isFinite(result)) evaluatedValue = result;
            } catch(e) {}
            updateState({ params: params.find(p => p.name === name) ? params.map(p => p.name === name ? { ...p, value: evaluatedValue } : p) : [...params, { name, value: evaluatedValue, min: evaluatedValue - 5, max: evaluatedValue + 5, step: 0.1 }] }, true);
            return;
        }

        const primeDerivMatch = val.match(/^(?:([a-zA-Z][\w]*)(?:\([a-zA-Z]\))?\s*=\s*)?([a-zA-Z][\w]*)'\s*(?:\([a-zA-Z]\))?$/i);
        const explicitDerivMatch = val.match(/^(?:([a-zA-Z][\w]*)(?:\([a-zA-Z]\))?\s*=\s*)?(?:derivative|diff)\s*\(\s*([a-zA-Z][\w]*)\s*\)\s*$/i);
        const derivMatch = primeDerivMatch || explicitDerivMatch;

        if (derivMatch) {
            const targetName = derivMatch[2];
            const source = functions.find(f => f.name === targetName);
            if (source) {
                const newFuncName = derivMatch[1] || FUNCTION_NAMES.find(n => !functions.map(f => f.name).includes(n)) || 'g';
                try {
                    nerdamer.clear('vars'); 
                    const deriv = nerdamer(`diff((${sanitizeExpression(source.expression)}), x)`).toString();
                    updateState({ 
                      functions: [...functions, { 
                        id: Date.now(), 
                        name: newFuncName, 
                        expression: deriv, 
                        inputValue: deriv, 
                        type: 'function', 
                        color: getNextColor(functions), 
                        visible: true, 
                        lineWidth: 2, 
                        lineStyle: 'solid', 
                        derivedFrom: source.id, 
                        derivationType: 'derivative' 
                      }] 
                    }, true);
                    return;
                } catch(e) {}
            }
        }

        let finalInput = val;
        let finalName = (analysis as any).name || FUNCTION_NAMES.find(n => !functions.map(f => f.name).includes(n)) || 'g';
        if (analysis.expr && (analysis.type === 'function' || analysis.type === 'implicit' || analysis.type === 'inequality')) {
            finalInput = analysis.expr;
        }

        updateState({ functions: [...functions, { id: Date.now(), name: finalName, expression: sanitizeExpression(analysis.expr || val), inputValue: finalInput, type: (analysis as any).type === 'parameter' ? 'implicit' : analysis.type, color: getNextColor(functions), visible: true, lineWidth: 2, lineStyle: 'solid' }] }, true);
    } catch(e) {}
  }, [functions, activeAnalyses, params, calculatedPoints]);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 text-slate-900 overflow-hidden font-sans">
      <Toolbar 
        activeTool={activeTool} onSelectTool={setActiveTool} 
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        toggleRightSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
        toggleSettings={() => setShowSettings(true)}
        showExact={showExact} toggleExact={() => setShowExact(!showExact)}
        onZoomText={(d) => setFontSize(prev => Math.max(10, Math.min(32, prev + d)))} precision={precision} onUpdatePrecision={(d) => setPrecision(prev => Math.max(0, Math.min(10, prev + d)))}
        onUndo={handleUndo} onRedo={handleRedo} canUndo={historyIndex > 0} canRedo={historyIndex < history.length - 1}
        rightSidebarOpen={rightSidebarOpen}
      />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          isOpen={sidebarOpen} 
          width={leftSidebarWidth}
          setWidth={setLeftSidebarWidth}
          functions={functions} params={params} view={view} activeAnalyses={activeAnalyses}
          calculatedPoints={calculatedPoints} editingObject={editingObject} setEditingObject={setEditingObject}
          contextMenu={null} setContextMenu={() => {}}
          onAddFunction={() => updateState({ functions: [...functions, { id: Date.now(), name: FUNCTION_NAMES.find(n => !functions.map(f => f.name).includes(n)) || 'f' + functions.length, expression: '', inputValue: '', type: 'function', color: getNextColor(functions), visible: true, lineWidth: 2, lineStyle: 'solid' }] }, true)} onUpdateFunction={updateFunction} onUpdateFunctionRange={(id, min, max) => updateState({ functions: functions.map(f => f.id !== id ? f : { ...f, rangeMin: min, rangeMax: max }) })} 
          onUpdateObjectStyle={(s) => editingObject && updateState(editingObject.type === 'function' ? { functions: functions.map(f => f.id === editingObject.id ? { ...f, ...s } : f) } : { activeAnalyses: activeAnalyses.map(a => String(a.id) === String(editingObject.id) ? { ...a, ...s } : a) }, true)} onFunctionSubmit={handleFunctionSubmit} onRemoveFunction={(id) => updateState({ functions: functions.filter(f => f.id !== id) }, true)} onRemoveAnalysis={removeAnalysis}
          onUpdateParam={(n, v) => updateState({ params: params.find(p => p.name === n) ? params.map(p => p.name === n ? { ...p, value: v } : p) : [...params, { name: n, value: v, min: v-5, max: v+5, step: 0.1 }] })} onUpdateParamSettings={(n, s) => updateState({ params: params.map(p => p.name === n ? { ...p, ...s } : p) }, true)} onRemoveParam={(n) => updateState({ params: params.filter(p => p.name !== n) }, true)} 
          onGeneralInput={handleGeneralInput} onDerivative={(id) => { const f = functions.find(fn => fn.id === id); if (f) { try { nerdamer.clear('vars'); const deriv = nerdamer(`diff((${sanitizeExpression(f.expression)}), x)`).toString(); updateState({ functions: [...functions, { id: Date.now(), name: 'g', expression: deriv, inputValue: deriv, type: 'function', color: getNextColor(functions), visible: true, lineWidth: 2, lineStyle: 'solid', derivedFrom: id, derivationType: 'derivative' }] }, true); } catch(e) {} } }} onIntegral={(id) => { const f = functions.find(fn => fn.id === id); if (f) { try { nerdamer.clear('vars'); const int = nerdamer(`integrate((${sanitizeExpression(f.expression)}), x)`).toString(); updateState({ functions: [...functions, { id: Date.now(), name: 'F', expression: int, inputValue: int, type: 'function', color: getNextColor(functions), visible: true, lineWidth: 2, lineStyle: 'solid', derivedFrom: id, derivationType: 'integral' }] }, true); } catch(e) {} } }}
          onUpdateAnalysisCoords={(id, x, y) => updateState({ activeAnalyses: activeAnalyses.map(a => String(a.id) === id ? (a.type === 'freePoint' ? { ...a, x, y } : { ...a, x }) : a) }, true)} onUpdateAnalysisLine={(id, eq) => { const def = parseLineEquation(eq); if (def) { const line = activeAnalyses.find(a => String(a.id) === id); if (line?.vertices?.length === 2) { const p1 = activeAnalyses.find(p => String(p.id) === String(line.vertices![0])), p2 = activeAnalyses.find(p => String(p.id) === String(line.vertices![1])); if (p1 && p2) { const n1 = projectPointOntoLine(p1.x!, p1.y!, def), n2 = projectPointOntoLine(p2.x!, p2.y!, def); updateState({ activeAnalyses: activeAnalyses.map(a => String(a.id) === String(p1.id) ? { ...a, ...n1 } : (String(a.id) === String(p2.id) ? { ...a, ...n2 } : a)) }, true); } } } }} precision={precision}
          rightSidebarOpen={rightSidebarOpen}
        />
        <Canvas 
          view={view} setView={setView} functions={functions} params={params} activeTool={activeTool} setActiveTool={setActiveTool} 
          activeAnalyses={activeAnalyses} setActiveAnalyses={setActiveAnalyses} polygonBuilder={polygonBuilder} setPolygonBuilder={setPolygonBuilder} 
          showExact={showExact} axisLabels={axisLabels} calculatedPoints={calculatedPoints} onRemoveAnalysis={removeAnalysis}
          onObjectDoubleClick={(id, type) => { setSidebarOpen(true); setEditingObject({ id, type }); }}
          onSizeChange={(w, h) => setCanvasSize({ width: w, height: h })}
          fontSize={fontSize} precision={precision} onCanvasInteraction={() => window.innerWidth < 768 && setSidebarOpen(false)} onHistoryCommit={() => updateState({}, true)}
        />
        <AIAssistant 
          isOpen={rightSidebarOpen} 
          width={rightSidebarWidth}
          setWidth={setRightSidebarWidth}
          functions={functions} 
          params={params} 
          view={view} 
          activeAnalyses={activeAnalyses}
          onGeneralInput={handleGeneralInput}
          onUpdateParam={(n, v) => updateState({ params: params.map(p => p.name === n ? { ...p, value: v } : p) })}
          onRemoveFunction={(id) => updateState({ functions: functions.filter(f => f.id !== id) }, true)}
          onUpdateParamSettings={(n, s) => updateState({ params: params.map(p => p.name === n ? { ...p, ...s } : p) }, true)}
          onRemoveParam={(n) => updateState({ params: params.filter(p => p.name !== n) }, true)}
          fontSize={fontSize}
        />
        {showSettings && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"><div className="bg-white rounded-lg shadow-xl p-6 w-80 border border-gray-200"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-800">Window Settings</h3><button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">✕</button></div><form onSubmit={(e) => { e.preventDefault(); const xMin = parseInputToNumber(windowBounds.xMin, -10), xMax = parseInputToNumber(windowBounds.xMax, 10), yMin = parseInputToNumber(windowBounds.yMin, -10), yMax = parseInputToNumber(windowBounds.yMax, 10); setView({ x: (xMax+xMin)/2, y: (yMax+yMin)/2, scaleX: canvasSize.width/(xMax-xMin), scaleY: canvasSize.height/(yMax-yMin) }); setAxisLabels(tempAxisLabels); setShowSettings(false); }} className="space-y-4"><div className="grid grid-cols-2 gap-4">{['xMin', 'xMax', 'yMin', 'yMax'].map(f => (<div key={f}><label className="block text-xs font-bold text-gray-500 mb-1 uppercase">{f}</label><input type="text" value={(windowBounds as any)[f]} onChange={e => setWindowBounds({...windowBounds, [f]: e.target.value})} className="w-full border rounded p-1 text-sm focus:border-[#007888] outline-none"/></div>))}</div><div className="border-t pt-4 mt-2"><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Axis Labels</label><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] text-gray-400 mb-1">X Label</label><input type="text" value={tempAxisLabels.x} onChange={e => setTempAxisLabels({...tempAxisLabels, x: e.target.value})} className="w-full border rounded p-1 text-sm focus:border-[#007888] outline-none"/></div><div><label className="block text-[10px] text-gray-400 mb-1">Y Label</label><input type="text" value={tempAxisLabels.y} onChange={e => setTempAxisLabels({...tempAxisLabels, y: e.target.value})} className="w-full border rounded p-1 text-sm focus:border-[#007888] outline-none"/></div></div></div><button type="submit" className="w-full bg-[#007888] text-white py-2 rounded text-sm font-bold hover:bg-[#004D40] mt-4">Apply</button></form></div></div>)}
      </div>
    </div>
  );
};

export default App;
