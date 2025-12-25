
import React, { useState, useRef, useEffect } from 'react';
import { MathFunction, MathParam, ViewPort, AnalysisObject, CalculatedPoint } from '../types';
import * as Icons from './Icons';
import { COLORS } from '../constants';
import { getLineEquationString, formatNumberDecimal, calculateObjectSlope, createMathScope, simpleAsciiToLatex, latexToAscii } from '../services/mathUtils';

interface SidebarProps {
  isOpen: boolean;
  width: number;
  setWidth: (width: number) => void;
  functions: MathFunction[];
  params: MathParam[];
  view: ViewPort;
  activeAnalyses: AnalysisObject[];
  calculatedPoints: CalculatedPoint[];
  editingObject: { id: number | string, type: 'function' | 'analysis' } | null;
  setEditingObject: (obj: { id: number | string, type: 'function' | 'analysis' } | null) => void;
  contextMenu: { id: number | string, type: 'function' | 'analysis', x: number, y: number } | null;
  setContextMenu: (menu: { id: number | string, type: 'function' | 'analysis', x: number, y: number } | null) => void;
  onAddFunction: () => void;
  onUpdateFunction: (id: number, value: string) => void;
  onUpdateFunctionRange: (id: number, min: string, max: string) => void;
  onUpdateObjectStyle: (style: any) => void;
  onFunctionSubmit: (id: number, value: string) => void; 
  onRemoveFunction: (id: number) => void;
  onRemoveAnalysis: (id: string) => void; 
  onUpdateParam: (name: string, val: number) => void;
  onUpdateParamSettings: (name: string, settings: { min: number, max: number, step: number }) => void;
  onRemoveParam: (name: string) => void;
  onGeneralInput: (val: string) => void;
  onDerivative?: (id: number) => void;
  onIntegral?: (id: number) => void;
  onUpdateAnalysisCoords: (id: string, x: number, y: number) => void;
  onUpdateAnalysisLine?: (id: string, equation: string) => void;
  precision: number;
  rightSidebarOpen?: boolean;
}

const MathInput = ({ value, onChange, onEnter, onFocus, placeholder, className = "" }: { value: string, onChange: (val: string) => void, onEnter?: (val: string) => void, onFocus?: () => void, placeholder?: string, className?: string }) => {
    const mfRef = useRef<HTMLElement>(null);
    const ignoreNextInput = useRef(false);

    useEffect(() => {
        const mf = mfRef.current as any;
        if (!mf) return;
        
        const currentAscii = latexToAscii(mf.value);
        if (value === "" && mf.value !== "") {
            mf.value = "";
        } else if (value !== currentAscii && document.activeElement !== mf) {
             ignoreNextInput.current = true;
             mf.value = simpleAsciiToLatex(value);
             setTimeout(() => { ignoreNextInput.current = false; }, 0);
        }
    }, [value]);

    useEffect(() => {
        const mf = mfRef.current;
        if (!mf) return;
        const handleInput = (e: Event) => {
            if (ignoreNextInput.current) return;
            const field = e.target as any;
            const ascii = latexToAscii(field.value);
            onChange(ascii);
        };
        const handleFocus = () => { if (onFocus) onFocus(); };
        const handleKeyDown = (e: KeyboardEvent) => {
            const field = mf as any;
            if (e.key === 'Enter') {
                e.preventDefault();
                const ascii = latexToAscii(field.value);
                if (onEnter) onEnter(ascii);
            }
            else if (e.key === '^') { e.preventDefault(); field.executeCommand('superscript'); }
        };
        mf.addEventListener('input', handleInput);
        mf.addEventListener('focus', handleFocus);
        mf.addEventListener('keydown', handleKeyDown);
        return () => {
            mf.removeEventListener('input', handleInput);
            mf.removeEventListener('focus', handleFocus);
            mf.removeEventListener('keydown', handleKeyDown);
        };
    }, [onChange, onEnter, onFocus]);

    return (
        // @ts-ignore
        <math-field 
            ref={mfRef} 
            class={className} 
            math-virtual-keyboard-policy="auto" 
            smart-fence="false" 
            smart-superscript="false" 
            auto-commands="pi theta sqrt sum int sin cos tan log ln asin acos atan" 
            placeholder={placeholder}
            menu-toggle="hidden"
            virtual-keyboard-toggle="hidden"
        >
        </math-field>
    );
};

const Latex = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => {
  try {
    const katex = (window as any).katex;
    if (!katex) return <span className={className}>{children}</span>;
    const str = children !== undefined && children !== null ? String(children) : "";
    const html = katex.renderToString(str, { throwOnError: false });
    return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch (e) { return <span className={className}>{children}</span>; }
};

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, width, setWidth, functions, params, activeAnalyses, calculatedPoints, editingObject, setEditingObject, contextMenu, setContextMenu,
  onAddFunction, onUpdateFunction, onUpdateFunctionRange, onUpdateObjectStyle, onFunctionSubmit, 
  onRemoveFunction, onRemoveAnalysis, onUpdateParam, onUpdateParamSettings, onRemoveParam, onGeneralInput,
  onUpdateAnalysisCoords, onUpdateAnalysisLine, precision, rightSidebarOpen
}) => {
  const [generalInput, setGeneralInput] = useState("");
  const [configModal, setConfigModal] = useState<{name: string, style: React.CSSProperties} | null>(null);
  const [editingCoords, setEditingCoords] = useState<{id: string, x: string, y: string, equation?: string} | null>(null);
  
  const isResizing = useRef(false);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = Math.max(200, Math.min(600, e.clientX));
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'default';
  };

  const handleGeneralSubmit = (val: string) => { 
    if (val.trim()) { 
      onGeneralInput(val); 
      setGeneralInput(""); 
    } 
  };

  const uniqueParams = Array.from(new Map(params.map(p => [p.name, p] as [string, MathParam])).values()) as MathParam[];
  
  const getTargetObject = () => { 
    const target = contextMenu || editingObject; 
    if (!target) return null; 
    if (target.type === 'function') return functions.find(f => String(f.id) === String(target.id)); 
    if (target.type === 'analysis') return activeAnalyses.find(a => String(a.id) === String(target.id)); 
    return null; 
  };
  
  const targetObj = getTargetObject();

  const getSubstitutedLatex = (expression: string) => {
    if (!expression) return "";
    let substituted = expression;
    uniqueParams.forEach(p => {
      const regex = new RegExp(`\\b${p.name}\\b`, 'g');
      substituted = substituted.replace(regex, `(${p.value})`);
    });
    try {
      const nerdamer = (window as any).nerdamer;
      if (!nerdamer) return substituted;
      return nerdamer(substituted).toTeX();
    } catch {
      return substituted;
    }
  };

  const getAnalysisLabel = (an: AnalysisObject) => {
    if (an.type === 'polygon') return `\\text{Polygon } (${an.vertices?.length || 0} \\text{ vertices})`;
    if (an.type === 'freePoint') return `\\text{Point } ${an.label || ''}`;
    if (an.type === 'pointOn_analysis') {
         const f = functions.find(fn => fn.id === an.funcId);
         const cp = calculatedPoints.find(p => String(p.id) === String(an.id));
         if (cp) return `${an.label || 'P'}(${formatNumberDecimal(cp.x, precision)}, ${formatNumberDecimal(cp.y, precision)})`;
         return `${an.label || 'P'} \\in ${f ? f.name : '?'}`;
    }
    if (an.type === 'tangent_analysis') {
         let label = an.label || 't'; let eq = "";
         if (an.funcId) {
             const f = functions.find(fn => fn.id === an.funcId);
             let x = an.x;
             if (an.vertices && an.vertices.length > 0) { const p = calculatedPoints.find(obj => String(obj.id) === String(an.vertices![0])); if (p && p.x !== undefined) x = p.x; }
             if (f && x !== undefined) {
                 try { const scope = createMathScope(params, calculatedPoints, activeAnalyses, functions); const y = (window as any).math.evaluate(f.expression, { ...scope, x: x }); const h = 0.0001; const y2 = (window as any).math.evaluate(f.expression, { ...scope, x: x + h }); const m = (y2 - y) / h; const b = y - m * x; eq = getLineEquationString({x: 0, y: b}, {x: 1, y: m + b}, precision); } catch {}
             }
         }
         return eq ? `${label}: ${eq}` : `\\text{Tangent Line } ${label}`;
    }
    if (an.type === 'line' && an.vertices && an.vertices.length === 2) {
        const p1 = activeAnalyses.find(p => String(p.id) === String(an.vertices![0])), p2 = activeAnalyses.find(p => String(p.id) === String(an.vertices![1]));
        if (p1 && p2 && p1.x !== undefined && p2.x !== undefined && p1.y !== undefined && p2.y !== undefined) return `${an.label || 'r'}: ${getLineEquationString({x: p1.x, y: p1.y}, {x: p2.x, y: p2.y}, precision)}`;
        return `\\text{Line } ${an.label || ''}`;
    }
    if (an.type === 'ray') return `\\text{Ray}`;
    if (an.type === 'segment') return `\\text{Segment}`;
    if (an.type === 'func_analysis') return `\\text{Points on Func} (${an.subtype || ''}) ${an.label || ''}`;
    if (an.type === 'intersection_analysis') return `\\text{Intersection } ${an.label || ''}`;
    if (an.type === 'slope_analysis') return `\\text{Slope}`;
    return `\\text{Geometric Object}`;
  }

  const startEditingCoords = (e: React.MouseEvent, an: AnalysisObject) => {
      e.stopPropagation(); e.preventDefault();
      if (an.type === 'line' && an.vertices?.length === 2) {
         const p1 = activeAnalyses.find(p => String(p.id) === String(an.vertices![0])), p2 = activeAnalyses.find(p => String(p.id) === String(an.vertices![1]));
         if (p1 && p2 && p1.x !== undefined && p1.y !== undefined && p2.x !== undefined && p2.y !== undefined) setEditingCoords({ id: String(an.id), x: '0', y: '0', equation: getLineEquationString({x: p1.x, y: p1.y}, {x: p2.x, y: p2.y}, precision) });
         return;
      }
      if ((an.type !== 'freePoint' && an.type !== 'pointOn_analysis') || (an.xExpr || an.yExpr)) return;
      setEditingCoords({ id: String(an.id), x: String(an.x ?? 0), y: String(an.y ?? 0) });
  };

  const saveCoords = () => {
      if (!editingCoords) return;
      if (editingCoords.equation !== undefined && onUpdateAnalysisLine) onUpdateAnalysisLine(editingCoords.id, editingCoords.equation);
      else { const x = parseFloat(editingCoords.x), y = parseFloat(editingCoords.y); if (!isNaN(x)) onUpdateAnalysisCoords(editingCoords.id, x, isNaN(y) ? 0 : y); }
      setEditingCoords(null);
  };

  const trueFunctions = functions.filter(f => f.type === 'function' || f.type === 'inequality' || f.type === 'empty' || f.type === 'implicit');
  const algebraicConstructions = functions.filter(f => f.type === 'vertical');

  return (
    <div 
      className={`${isOpen ? 'border-r border-[#E5E7EB]' : 'w-0'} bg-white flex flex-col transition-all duration-300 overflow-hidden relative shadow-lg z-10 h-full`}
      style={{ width: isOpen ? `${width}px` : '0px' }}
    >
      {isOpen && (
        <div 
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[#007888]/30 active:bg-[#007888]/50 z-20 transition-colors"
          onMouseDown={handleMouseDown}
        />
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-16"> 
          {trueFunctions.map(f => {
            const isRelation = f.type === 'implicit' || f.type === 'inequality';
            const hasParamsInExpr = f.expression && uniqueParams.some(p => new RegExp(`\\b${p.name}\\b`).test(f.expression));
            const substitutedLatex = hasParamsInExpr ? getSubstitutedLatex(f.expression) : "";
            const prefix = isRelation ? `\\text{${f.name.replace(/_prime/g, "'")}}:` : `\\text{${f.name.replace(/_prime/g, "'")}}(x)=`;

            return (
            <div key={f.id} className="relative"> 
            <div className={`group border border-gray-200 hover:border-[#1CA6B2] p-3 rounded bg-gray-50 flex flex-col gap-2 transition-colors ${editingObject?.id === f.id && editingObject?.type === 'function' ? 'ring-2 ring-[#007888] border-[#007888]' : ''}`}> 
                <div className="flex items-center gap-2"> 
                    <div className="w-8 h-8 cursor-pointer flex items-center justify-center hover:bg-gray-200 rounded transition-colors flex-shrink-0" onClick={() => setEditingObject({id: f.id, type: 'function'})} title="Properties">
                        <div className="h-5 w-0 border-l-[4px] rounded-sm" style={{ borderColor: f.visible !== false ? f.color : '#cbd5e1', borderLeftStyle: f.lineStyle || 'solid', opacity: f.visible !== false ? 1 : 0.3 }} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {hasParamsInExpr && substitutedLatex ? (
                        <div className="text-base font-bold text-gray-800 py-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
                          <Latex>{isRelation ? `\\text{${f.name.replace(/_prime/g, "'")}}: ${substitutedLatex}` : `\\text{${f.name.replace(/_prime/g, "'")}}(x)=${substitutedLatex}`}</Latex>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="font-serif italic text-gray-500 font-medium"><Latex>{prefix}</Latex></span>
                          <MathInput value={f.inputValue} onChange={(val) => onUpdateFunction(f.id, val)} onEnter={(val) => onFunctionSubmit(f.id, val)} className="bg-transparent" />
                        </div>
                      )}
                    </div>
                    <button onClick={() => onRemoveFunction(f.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Icons.IconTrash /></button> 
                </div> 

                {hasParamsInExpr && substitutedLatex && (
                  <div className="flex items-center gap-2 pl-8 border-t border-gray-100 pt-2 mt-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 whitespace-nowrap">Edit:</span>
                    <div className="flex-1 bg-white rounded border border-gray-200 px-1">
                      <MathInput value={f.inputValue} onChange={(val) => onUpdateFunction(f.id, val)} onEnter={(val) => onFunctionSubmit(f.id, val)} className="text-xs py-0 h-6" />
                    </div>
                  </div>
                )}

                {f.type === 'function' && ( <div className="flex items-center gap-1 text-[10px] text-gray-400 pl-8"> <span>Domain: [</span><input className="w-10 bg-transparent border-b border-gray-300 text-center focus:border-[#007888] focus:outline-none text-gray-600" placeholder="-∞" value={f.rangeMin || ''} onChange={e => onUpdateFunctionRange(f.id, e.target.value, f.rangeMax || '')}/><span>,</span><input className="w-10 bg-transparent border-b border-gray-300 text-center focus:border-[#007888] focus:outline-none text-gray-600" placeholder="+∞" value={f.rangeMax || ''} onChange={e => onUpdateFunctionRange(f.id, f.rangeMin || '', e.target.value)}/><span>]</span> </div> )} 
            </div> 
            </div>
          )})} <button onClick={onAddFunction} className="w-full py-2 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-[#1CA6B2] hover:text-[#007888] text-sm font-bold transition-colors">+ Add Expression</button> 
          
          <div className="border-t border-[#E5E7EB] pt-4 mt-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Constructions</h3>
            
            {algebraicConstructions.map(f => {
              const hasParamsInExpr = f.expression && uniqueParams.some(p => new RegExp(`\\b${p.name}\\b`).test(f.expression));
              const substitutedLatex = hasParamsInExpr ? getSubstitutedLatex(f.expression) : "";

              return (
              <div key={f.id} className={`mb-2 group border border-gray-200 hover:border-[#1CA6B2] p-3 rounded bg-gray-50 flex flex-col gap-1 transition-colors ${editingObject?.id === f.id && editingObject?.type === 'function' ? 'ring-2 ring-[#007888] border-[#007888]' : ''}`}>
                  <div className="flex items-center gap-2">
                      <div className="w-6 h-6 cursor-pointer flex items-center justify-center hover:bg-gray-200 rounded transition-colors flex-shrink-0" onClick={() => setEditingObject({id: f.id, type: 'function'})}>
                          <div className="h-4 w-0 border-l-[3px] rounded-sm" style={{ borderColor: f.visible !== false ? f.color : '#cbd5e1', borderLeftStyle: f.lineStyle || 'solid', opacity: f.visible !== false ? 1 : 0.3 }} />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        {hasParamsInExpr && substitutedLatex ? (
                          <div className="text-sm font-bold text-gray-700 overflow-x-auto whitespace-nowrap scrollbar-hide">
                            <Latex>{`\\text{${f.name.replace(/_prime/g, "'")}}: ${substitutedLatex}`}</Latex>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="font-serif italic text-gray-500 font-medium text-sm"><Latex>{`\\text{${f.name.replace(/_prime/g, "'")}}:`}</Latex></span>
                            <MathInput value={f.inputValue} onChange={(val) => onUpdateFunction(f.id, val)} onEnter={(val) => onFunctionSubmit(f.id, val)} className="bg-transparent text-sm" />
                          </div>
                        )}
                      </div>
                      <button onClick={() => onRemoveFunction(f.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Icons.IconTrash /></button>
                  </div>
              </div>
            )})}

            {activeAnalyses.length === 0 && algebraicConstructions.length === 0 && <div className="text-gray-400 text-xs italic">No constructions yet.</div>}
            {activeAnalyses.map(an => {
                const aidStr = String(an.id);
                const calcPt = calculatedPoints.find(cp => String(cp.id) === aidStr);
                const isPointOnFunction = an.type === 'pointOn_analysis';
                const currentX = calcPt ? calcPt.x : an.x; 
                const currentY = calcPt ? calcPt.y : an.y;
                let displaySlope: number | undefined;
                if (an.type === 'slope_analysis' && an.targetId) { 
                    const target = activeAnalyses.find(a => String(a.id) === String(an.targetId)); 
                    if (target) displaySlope = calculateObjectSlope(target, functions, activeAnalyses, params, calculatedPoints); 
                }
                let derivedPoints = (an.type === 'intersection_analysis' || an.type === 'func_analysis') ? calculatedPoints.filter(cp => String(cp.id) === aidStr || String(cp.id).startsWith(aidStr + '-')) : [];
                
                if (isPointOnFunction && !calcPt) return null;

                return (
                <div key={an.id} className={`relative mb-2 group border border-gray-200 hover:border-[#1CA6B2] p-2 rounded bg-gray-50 flex items-center justify-between transition-colors ${String(editingObject?.id) === aidStr && editingObject?.type === 'analysis' ? 'ring-2 ring-[#007888] border-[#007888]' : ''} ${an.visible === false ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => setEditingObject({id: an.id, type: 'analysis'})}>
                         <div className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ backgroundColor: an.color || '#4f46e5', borderColor: an.color || '#4f46e5' }} />
                         {editingCoords?.id === aidStr ? (
                            <div className="flex gap-1 items-center w-full" onClick={e => e.stopPropagation()}>
                                {editingCoords.equation !== undefined ? (<><span className="text-gray-500 text-xs font-bold">{an.label || 'r'}:</span><input className="flex-1 ml-1 border-b border-blue-500 text-xs focus:outline-none bg-white font-mono" value={editingCoords.equation} onChange={e => setEditingCoords({...editingCoords, equation: e.target.value})} onKeyDown={e => e.key === 'Enter' && saveCoords()} autoFocus /></>) : (<><span className="text-gray-500 text-xs">{an.label || 'P'}(</span><input className="w-12 border-b border-blue-500 text-xs text-center focus:outline-none bg-white" value={editingCoords.x} onChange={e => setEditingCoords({...editingCoords, x: e.target.value})} onKeyDown={e => e.key === 'Enter' && saveCoords()} autoFocus />{an.type === 'freePoint' && (<><span className="text-gray-500 text-xs">,</span><input className="w-12 border-b border-blue-500 text-xs text-center focus:outline-none bg-white" value={editingCoords.y} onChange={e => setEditingCoords({...editingCoords, y: e.target.value})} onKeyDown={e => e.key === 'Enter' && saveCoords()} /></>)}{an.type === 'pointOn_analysis' && (<><span className="text-gray-500 text-xs">,</span><span className="text-gray-500 text-xs px-1">{currentY !== undefined ? formatNumberDecimal(currentY, precision) : '?'}</span></>)}<span className="text-gray-500 text-xs">)</span></>)}
                                <button onClick={(e) => { e.stopPropagation(); saveCoords(); }} className="text-check ml-1 hover:bg-green-100 rounded p-0.5 text-green-600"><Icons.IconCheck /></button>
                                <button onClick={() => setEditingCoords(null)} className="text-cancel ml-1 hover:bg-red-100 rounded p-0.5 text-red-500"><Icons.IconCancel /></button>
                            </div>
                         ) : ( 
                            (an.type === 'intersection_analysis' || an.type === 'func_analysis') ? (
                                <div className="flex flex-col w-full">
                                    <span className="text-sm font-bold text-gray-700"><Latex>{`\\text{${an.type === 'intersection_analysis' ? (an.label || 'Intersection') : (an.subtype === 'zeros' ? 'Roots' : (an.subtype === 'max' ? 'Maxima' : 'Minima'))}}`}</Latex></span>
                                    {derivedPoints.length > 0 ? (derivedPoints.map(pt => (<div key={pt.id} className="text-sm text-gray-600 pl-1 mt-0.5"><Latex>{pt.latex || pt.label}</Latex></div>))) : (<span className="text-[10px] text-gray-400 italic pl-1">Calculating...</span>)}
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-sm text-gray-700 font-medium cursor-text hover:bg-gray-100 rounded px-1 transition-colors" onClick={(e) => startEditingCoords(e, an)} title="Click to edit">
                                    {an.type === 'slope_analysis' ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-800"><Latex>{`${an.label || 'm'} = ${displaySlope !== undefined ? formatNumberDecimal(displaySlope, precision) : '?'}`}</Latex></div>
                                    ) : (
                                        <Latex>{getAnalysisLabel(an)}</Latex>
                                    )}
                                </div>
                            )
                         )}
                    </div>
                    <button onClick={() => onRemoveAnalysis(aidStr)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Icons.IconTrash /></button>
                </div>
            )})}
          </div>

          <div className="border-t border-[#E5E7EB] pt-4 mt-2"> <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Parameters</h3> {uniqueParams.map(p => ( <div key={p.name} className="mb-4 bg-white p-3 rounded border border-gray-200 shadow-sm relative group hover:border-[#1CA6B2] transition-colors" onDoubleClick={(e) => { e.preventDefault(); const rect = e.currentTarget.getBoundingClientRect(); setConfigModal({ name: p.name, style: { top: rect.top, left: rect.left } }); }} > <div className="flex justify-between mb-2"><span className="font-bold text-[#007888] font-mono cursor-pointer select-none">{p.name} = {p.value}</span><button onClick={() => onRemoveParam(p.name)} className="text-gray-400 hover:text-red-500"><Icons.IconTrash /></button></div> <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={e => onUpdateParam(p.name, parseFloat(e.target.value))} className="w-full accent-[#FBB01B] h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/> <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono"><span>{p.min}</span><span>{p.max}</span></div> </div> ))} </div> </div>
      <div className="p-3 bg-gray-50 border-t border-[#E5E7EB]">
          <div className="w-full p-2 border border-gray-300 rounded focus-within:ring-1 focus-within:ring-[#007888] bg-white">
              <MathInput value={generalInput} onChange={setGeneralInput} onEnter={handleGeneralSubmit} placeholder="Input (e.g., y=2x+1)" />
          </div>
      </div>
      {configModal && <div className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-48 animate-fade-in-down" style={configModal.style}> <div className="flex justify-between items-center mb-3 border-b pb-2"><h4 className="text-xs font-bold uppercase text-[#007888]">Setup {configModal.name}</h4><button onClick={() => setConfigModal(null)} className="text-gray-400 hover:text-gray-600">✕</button></div><div className="space-y-2"><div><label className="block text-[10px] font-bold text-gray-500">Min</label><input type="number" step="any" defaultValue={uniqueParams.find(p => p.name === configModal.name)?.min} onBlur={e => onUpdateParamSettings(configModal.name, { min: parseFloat(e.target.value), max: uniqueParams.find(p => p.name === configModal.name)!.max, step: uniqueParams.find(p => p.name === configModal.name)!.step })} className="w-full border rounded p-1 text-xs focus:border-[#007888] outline-none"/></div><div><label className="block text-[10px] font-bold text-gray-500">Max</label><input type="number" step="any" defaultValue={uniqueParams.find(p => p.name === configModal.name)?.max} onBlur={e => onUpdateParamSettings(configModal.name, { min: uniqueParams.find(p => p.name === configModal.name)!.min, max: parseFloat(e.target.value), step: uniqueParams.find(p => p.name === configModal.name)!.step })} className="w-full border rounded p-1 text-xs focus:border-[#007888] outline-none"/></div><button onClick={() => setConfigModal(null)} className="w-full bg-[#007888] text-white py-1 rounded text-xs font-bold mt-2">OK</button></div></div>}
      {(contextMenu || (editingObject && targetObj)) && (
          <><div className="fixed inset-0 z-40" onClick={() => { setContextMenu(null); setEditingObject(null); }}></div>
          <div className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72 overflow-y-auto max-h-[85vh] transition-all" style={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : { top: 80, right: rightSidebarOpen ? 340 : 20 }}>
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h4 className="text-sm font-bold uppercase text-[#007888] tracking-wider">Properties</h4>
                <button onClick={() => { setContextMenu(null); setEditingObject(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <Icons.IconCancel />
                </button>
            </div>
            
            <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-tighter">Color</label>
                  <div className="grid grid-cols-4 gap-2">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => onUpdateObjectStyle({ color: c })} className={`w-full aspect-square rounded-md border-2 transition-all ${targetObj.color === c ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent hover:border-gray-300'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-tighter">Visibility & Trace</label>
                  <div className="flex gap-2">
                    <button onClick={() => onUpdateObjectStyle({ visible: !targetObj.visible })} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${targetObj.visible !== false ? 'bg-[#E0F2F1] text-[#007888] border border-[#B2DFDB]' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>{targetObj.visible !== false ? 'Visible' : 'Hidden'}</button>
                    <button onClick={() => onUpdateObjectStyle({ trace: !targetObj.trace })} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${targetObj.trace ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>{targetObj.trace ? 'Trace On' : 'Trace Off'}</button>
                  </div>
                </div>

                {(targetObj.type === 'function' || ['line', 'ray', 'segment', 'polygon', 'tangent_analysis', 'inequality', 'vertical', 'implicit'].includes(targetObj.type as any)) && (
                  <div className="space-y-4 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-tighter">Line Style</label>
                      <div className="flex gap-1.5">
                        {['solid', 'dashed', 'dotted'].map(s => (
                          <button key={s} onClick={() => onUpdateObjectStyle({ lineStyle: s })} className={`flex-1 py-1.5 rounded-md border text-[10px] uppercase font-bold transition-all ${targetObj.lineStyle === s || (s === 'solid' && !targetObj.lineStyle) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{s === 'solid' ? 'Solid' : (s === 'dashed' ? 'Dashed' : 'Dotted')}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-tighter">Width</label>
                        <span className="text-xs font-mono font-bold text-[#007888]">{targetObj.lineWidth || 2}</span>
                      </div>
                      <input type="range" min="1" max="12" step="0.5" value={targetObj.lineWidth || 2} onChange={e => onUpdateObjectStyle({ lineWidth: parseFloat(e.target.value) })} className="w-full accent-[#007888] h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                    </div>
                  </div>
                )}

                {['freePoint', 'pointOn_analysis', 'intersection_analysis', 'func_analysis'].includes(targetObj.type as any) && (
                  <div className="space-y-4 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-tighter">Point Style</label>
                      <div className="flex gap-1.5">
                        {['solid', 'open', 'cross'].map(s => (
                          <button key={s} onClick={() => onUpdateObjectStyle({ pointStyle: s })} className={`flex-1 py-1.5 rounded-md border text-[10px] uppercase font-bold transition-all ${targetObj.pointStyle === s || (s === 'solid' && !targetObj.pointStyle) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{s === 'solid' ? 'Solid' : (s === 'open' ? 'Open' : 'Cross')}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-tighter">Size</label>
                        <span className="text-xs font-mono font-bold text-[#007888]">{targetObj.size || 5}</span>
                      </div>
                      <input type="range" min="2" max="18" step="1" value={targetObj.size || 5} onChange={e => onUpdateObjectStyle({ size: parseFloat(e.target.value) })} className="w-full accent-[#007888] h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                    </div>
                  </div>
                )}
            </div>
          </div>
          </>
      )}
    </div>
  );
};

export default Sidebar;
