
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ViewPort, MathFunction, MathParam, AnalysisObject, CalculatedPoint, ToolType } from '../types';
import { worldToScreen, screenToWorld, formatNumberDecimal, solveSymbolic, solveIntersection, formatNumberToLatex, getBestLatex, hexToRgba, getNextPointLabel, getNextLineLabel, createMathScope, getLineEquationString } from '../services/mathUtils';
import * as Icons from './Icons';

interface CanvasProps {
  view: ViewPort;
  setView: React.Dispatch<React.SetStateAction<ViewPort>>;
  functions: MathFunction[];
  params: MathParam[];
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  activeAnalyses: AnalysisObject[];
  setActiveAnalyses: React.Dispatch<React.SetStateAction<AnalysisObject[]>>;
  polygonBuilder: string[];
  setPolygonBuilder: React.Dispatch<React.SetStateAction<string[]>>;
  showExact: boolean;
  axisLabels: { x: string, y: string };
  calculatedPoints: CalculatedPoint[];
  onObjectDoubleClick?: (id: number | string, type: 'function' | 'analysis') => void;
  onObjectContextMenu?: (id: number | string, type: 'function' | 'analysis', x: number, y: number) => void;
  onRemoveFunction?: (id: number) => void;
  onRemoveAnalysis?: (id: string) => void;
  onSizeChange?: (width: number, height: number) => void;
  onCanvasInteraction?: () => void;
  onHistoryCommit: () => void;
  fontSize: number;
  precision: number;
}

const Canvas: React.FC<CanvasProps> = ({ 
  view, setView, functions, params, activeTool, setActiveTool, activeAnalyses, setActiveAnalyses, polygonBuilder, setPolygonBuilder, showExact, axisLabels, calculatedPoints, onObjectDoubleClick, onObjectContextMenu, onRemoveFunction, onRemoveAnalysis, onSizeChange, onCanvasInteraction, onHistoryCommit, fontSize, precision
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const traceCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);
  const [lineBuilder, setLineBuilder] = useState<string | null>(null);
  const [labelOffsets, setLabelOffsets] = useState<Record<string, {x: number, y: number}>>({});
  const [draggedLabel, setDraggedLabel] = useState<{ id: string, startX: number, startY: number, startOffsetX: number, startOffsetY: number } | null>(null);

  useEffect(() => { setLineBuilder(null); setPolygonBuilder([]); }, [activeTool, setPolygonBuilder]);
  useEffect(() => { const ctx = traceCanvasRef.current?.getContext('2d'); if (ctx) ctx.clearRect(0, 0, size.width * 2, size.height * 2); }, [view.x, view.y, view.scaleX, view.scaleY, size]);
  useEffect(() => { 
    if (!containerRef.current) return; 
    const updateSize = () => { if(containerRef.current) { const w = containerRef.current.offsetWidth, h = containerRef.current.offsetHeight; setSize({ width: w, height: h }); if (onSizeChange) onSizeChange(w, h); } }; 
    const observer = new ResizeObserver(updateSize); observer.observe(containerRef.current); updateSize(); return () => observer.disconnect(); 
  }, [onSizeChange]);

  useEffect(() => { 
    if (!draggedLabel) return; 
    const handleWinMove = (clientX: number, clientY: number) => { 
        const dx = clientX - draggedLabel.startX, dy = clientY - draggedLabel.startY; 
        setLabelOffsets(prev => ({ ...prev, [draggedLabel.id]: { x: draggedLabel.startOffsetX + dx, y: draggedLabel.startOffsetY + dy } })); 
    }; 
    const onMouseMove = (e: MouseEvent) => handleWinMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 0) {
            handleWinMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    };
    const handleWinUp = () => setDraggedLabel(null); 
    
    window.addEventListener('mousemove', onMouseMove); 
    window.addEventListener('mouseup', handleWinUp); 
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', handleWinUp);
    return () => { 
        window.removeEventListener('mousemove', onMouseMove); 
        window.removeEventListener('mouseup', handleWinUp); 
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', handleWinUp);
    }; 
  }, [draggedLabel]);

  const handleLabelDoubleClick = (e: React.MouseEvent | React.TouchEvent, id: string) => { e.stopPropagation(); if (onObjectDoubleClick) onObjectDoubleClick(id.replace(/-label$/, '').replace(/-area$/, ''), 'analysis'); };
  const hasTrigFunctions = useMemo(() => functions.some(f => f.visible && f.expression && /\b(sin|cos|tan|sec|csc|cot)\b/.test(f.expression)), [functions]);
  const origin = useMemo(() => worldToScreen({x: 0, y: 0}, {view, width: size.width, height: size.height}), [view, size]);

  const axisTicks = useMemo(() => { 
    const { width, height } = size; 
    const w2s = (x: number, y: number) => worldToScreen({x, y}, {view, width, height}), s2w = (x: number, y: number) => screenToWorld({x, y}, {view, width, height}); 
    const tl = s2w(0, 0), br = s2w(width, height), originPos = w2s(0, 0); 
    let stepX = 1; 
    if (hasTrigFunctions) { const pxPerPi2 = (Math.PI/2) * view.scaleX; stepX = Math.PI / 2; if (pxPerPi2 < 40) stepX = Math.PI; if (pxPerPi2 < 20) stepX = 2 * Math.PI; if (pxPerPi2 > 200) stepX = Math.PI / 4; } 
    else { const roughStep = (br.x - tl.x) / 8, magnitude = Math.pow(10, Math.floor(Math.log10(roughStep))); stepX = magnitude * (roughStep / magnitude < 2 ? 1 : roughStep / magnitude < 5 ? 2 : 5); } 
    stepX = Math.max(stepX, 1e-10); const roughStepY = (tl.y - br.y) / 8, magY = Math.pow(10, Math.floor(Math.log10(roughStepY))); const stepY = Math.max(magY * (roughStepY / magY < 2 ? 1 : roughStepY / magY < 5 ? 2 : 5), 1e-10); 
    const xTicks = []; const startX = Math.floor(tl.x / stepX) * stepX; 
    for (let x = startX; x <= br.x + stepX; x += stepX) { if (Math.abs(x) < 1e-9) continue; const s = w2s(x, 0); if (s.x < -20 || s.x > width + 20) continue; let latex = hasTrigFunctions ? formatNumberToLatex(x) : parseFloat(x.toFixed(4)).toString(), yPos = originPos.y + 8; if (yPos < 8) yPos = 8; if (yPos > height - 25) yPos = height - 25; xTicks.push({ id: `x-${x}`, x: s.x, y: yPos, latex }); } 
    const yTicks = []; const startY = Math.floor(br.y / stepY) * stepY; 
    for (let y = startY; y <= tl.y + stepY; y += stepY) { if (Math.abs(y) < 1e-9) continue; const s = w2s(0, y); if (s.y < -15 || s.y > height + 15) continue; let xPos = originPos.x - 8, align: 'flex-end' | 'flex-start' = 'flex-end'; if (originPos.x < 40) { xPos = Math.max(originPos.x + 8, 10); align = 'flex-start'; } else if (originPos.x > width - 10) { xPos = width - 10; align = 'flex-end'; } else { xPos = originPos.x - 8; align = 'flex-end'; } yTicks.push({ id: `y-${y}`, x: xPos, y: s.y, latex: parseFloat(y.toFixed(4)).toString(), align }); } 
    return { xTicks, yTicks }; 
  }, [view, size, hasTrigFunctions]);

  const displayPoints = useMemo(() => {
    const points: CalculatedPoint[] = [...calculatedPoints];
    const math = (window as any).math;
    const scope = createMathScope(params, calculatedPoints, activeAnalyses, functions);
    activeAnalyses.forEach((an, idx) => {
        if (an.visible === false) return;
        const aid = String(an.id);
        if (an.type === 'tangent_analysis' && an.funcId) {
             const f = functions.find(fn => fn.id === an.funcId);
             let x = an.x;
             if (an.vertices && an.vertices.length > 0) { const refPoint = points.find(p => String(p.id) === String(an.vertices![0])); if (refPoint) x = refPoint.x; }
             if (x !== undefined && f && math) {
                 try {
                     const yVal = math.evaluate(f.expression, { ...scope, x: x }), h = 0.0001;
                     const y2 = math.evaluate(f.expression, { ...scope, x: x + h });
                     const m = (y2 - yVal) / h, b = yVal - m * x;
                     let mStr = Math.abs(m) < 1e-9 ? "" : (Math.abs(m - 1) < 1e-9 ? "x" : (Math.abs(m + 1) < 1e-9 ? "-x" : `${formatNumberDecimal(m, precision)}x`));
                     let bStr = Math.abs(b) > 1e-9 ? (b > 0 ? (mStr ? ` + ${formatNumberDecimal(b, precision)}` : formatNumberDecimal(b, precision)) : ` - ${formatNumberDecimal(Math.abs(b), precision)}`) : (!mStr ? "0" : "");
                     points.push({ id: `${aid}-label`, x: x + 1, y: yVal + m, latex: an.label ? `${an.label}: y = ${mStr}${bStr}` : `y = ${mStr}${bStr}`, isLabelAnchor: true, analysisIndex: idx });
                 } catch {}
             }
        } else if ((an.type === 'line' || an.type === 'ray' || an.type === 'segment') && an.vertices && an.vertices.length === 2) {
             const v1 = points.find(p => String(p.id) === String(an.vertices![0])), v2 = points.find(p => String(p.id) === String(an.vertices![1]));
             if (v1 && v2 && an.type !== 'segment') points.push({ id: `${aid}-label`, x: (v1.x + v2.x)/2, y: (v1.y + v2.y)/2, latex: an.label ? `${an.label}: ${getLineEquationString({x: v1.x, y: v1.y}, {x: v2.x, y: v2.y}, precision)}` : getLineEquationString({x: v1.x, y: v1.y}, {x: v2.x, y: v2.y}, precision), isLabelAnchor: true, analysisIndex: idx });
        } else if (an.type === 'polygon' && an.vertices && an.vertices.length >= 3) {
            const vertices = an.vertices.map(vid => points.find(pt => String(pt.id) === String(vid))).filter(Boolean) as {x: number, y: number}[];
            if (vertices.length === an.vertices.length) {
                let area = 0; for (let i = 0; i < vertices.length; i++) { const j = (i + 1) % vertices.length; area += vertices[i].x * vertices[j].y; area -= vertices[j].x * vertices[i].y; }
                area = Math.abs(area / 2); let cx = 0, cy = 0; for (const v of vertices) { cx += v.x; cy += v.y; }
                points.push({ id: `${aid}-area`, x: cx / vertices.length, y: cy / vertices.length, latex: `\\text{Area} = ${showExact ? getBestLatex(area, "") : formatNumberDecimal(area, precision)}`, isLabelAnchor: true, analysisIndex: idx });
            }
        }
    });
    return points;
  }, [calculatedPoints, activeAnalyses, showExact, params, functions, precision]);

  const getClosestObject = (cx: number, cy: number) => { 
      const width = size.width, height = size.height; 
      const math = (window as any).math;
      for (const pt of displayPoints) { 
          const parentAnalysis = activeAnalyses[pt.analysisIndex]; if (parentAnalysis && parentAnalysis.visible === false) continue;
          if (pt.isLabelAnchor) continue; 
          const s = worldToScreen({x: pt.x, y: pt.y}, {view, width, height}); 
          if (Math.hypot(s.x - cx, s.y - cy) < 20) return { id: activeAnalyses[pt.analysisIndex]?.id || pt.id, type: 'analysis' as const }; 
      } 
      for (const obj of activeAnalyses) {
          if (obj.visible === false) continue;
          if ((obj.type === 'line' || obj.type === 'ray' || obj.type === 'segment') && obj.vertices && obj.vertices.length === 2) {
               const v1 = displayPoints.find(p => String(p.id) === String(obj.vertices![0])), v2 = displayPoints.find(p => String(p.id) === String(obj.vertices![1]));
               if (v1 && v2) {
                   const s1 = worldToScreen({x:v1.x, y:v1.y}, {view, width, height}), s2 = worldToScreen({x:v2.x, y:v2.y}, {view, width, height});
                   const A = cx - s1.x, B = cy - s1.y, C = s2.x - s1.x, D = s2.y - s1.y, dot = A * C + B * D, lenSq = C * C + D * D;
                   let param = lenSq !== 0 ? dot / lenSq : -1, xx, yy;
                   if (obj.type === 'segment') { if (param < 0) { xx = s1.x; yy = s1.y; } else if (param > 1) { xx = s2.x; yy = s2.y; } else { xx = s1.x + param * C; yy = s1.y + param * D; } }
                   else if (obj.type === 'ray') { if (param < 0) { xx = s1.x; yy = s1.y; } else { xx = s1.x + param * C; yy = s1.y + param * D; } }
                   else { xx = s1.x + param * C; yy = s1.y + param * D; }
                   if (Math.sqrt((cx - xx)**2 + (cy - yy)**2) < 15) return { id: obj.id, type: 'analysis' as const };
               }
          }
      }
      const numScope = createMathScope(params, calculatedPoints, activeAnalyses, functions);
      let bestFuncId: number | null = null, minDist = 20;
      functions.forEach(f => { 
          if (!f.visible || !f.expression || !math) return; 
          if (f.type === 'vertical') { try { const val = math.evaluate(f.expression, numScope), s = worldToScreen({x: val, y: 0}, {view, width, height}); if (Math.abs(s.x - cx) < 15) { minDist = Math.abs(s.x - cx); bestFuncId = f.id; } } catch {} return; }
          try { 
              let rMin = -Infinity, rMax = Infinity; 
              if (f.rangeMin) { const v=math.evaluate(f.rangeMin, numScope); if(!isNaN(v)) rMin=v; } 
              if (f.rangeMax) { const v=math.evaluate(f.rangeMax, numScope); if(!isNaN(v)) rMax=v; } 
              const wx = screenToWorld({x: cx, y: cy}, {view, width, height}).x; if (wx < rMin || wx > rMax) return;
              const val = math.evaluate(f.expression, { ...numScope, x: wx }), sY = worldToScreen({x: wx, y: val}, {view, width, height}).y;
              const wx2 = screenToWorld({x: cx + 1, y: cy}, {view, width, height}).x, val2 = math.evaluate(f.expression, { ...numScope, x: wx2 }), sY2 = worldToScreen({x: wx2, y: val2}, {view, width, height}).y;
              const perpDist = Math.abs(sY - cy) / Math.sqrt((sY2 - sY)**2 + 1); if (perpDist < minDist) { minDist = perpDist; bestFuncId = f.id; } 
          } catch (e) {} 
      }); 
      return bestFuncId !== null ? { id: bestFuncId, type: 'function' as const } : null; 
  };

  const draw = useCallback(() => {
      const canvas = canvasRef.current, traceCanvas = traceCanvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext('2d'), traceCtx = traceCanvas?.getContext('2d'); if (!ctx) return;
      const math = (window as any).math;
      const { width, height } = size, dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr) { canvas.width = width * dpr; canvas.height = height * dpr; if (traceCanvas) { traceCanvas.width = width * dpr; traceCanvas.height = height * dpr; } }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      if (traceCtx) traceCtx.setTransform(dpr, 0, 0, dpr, 0, 0); 
      const w2s = (x: number, y: number) => worldToScreen({x, y}, {view, width, height}), s2w = (x: number, y: number) => screenToWorld({x, y}, {view, width, height});
      ctx.lineWidth = 0.5; ctx.strokeStyle = '#e2e8f0'; const tl = s2w(0, 0), br = s2w(width, height);
      let stepX = 1; const roughStepX = Math.abs(br.x - tl.x) / 10, magX = Math.pow(10, Math.floor(Math.log10(roughStepX))); stepX = Math.max(magX * (roughStepX / magX < 2 ? 1 : roughStepX / magX < 5 ? 2 : 5), 1e-10); if (hasTrigFunctions) { stepX = Math.PI / 2; if (view.scaleX < 20) stepX = Math.PI * 2; }
      const roughStepY = Math.abs(tl.y - br.y) / 10, magY = Math.pow(10, Math.floor(Math.log10(roughStepY))), stepY = Math.max(magY * (roughStepY / magY < 2 ? 1 : roughStepY / magY < 5 ? 2 : 5), 1e-10);
      ctx.beginPath(); for (let x = Math.floor(tl.x / stepX) * stepX; x <= br.x + stepX; x += stepX) { const s = w2s(x, 0); ctx.moveTo(s.x, 0); ctx.lineTo(s.x, height); }
      for (let y = Math.floor(br.y / stepY) * stepY; y <= tl.y + stepY; y += stepY) { const s = w2s(0, y); ctx.moveTo(0, s.y); ctx.lineTo(width, s.y); } ctx.stroke();
      const originPos = w2s(0, 0); ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5; ctx.beginPath();
      if (originPos.y >= -20 && originPos.y <= height + 20) { ctx.moveTo(0, originPos.y); ctx.lineTo(width, originPos.y); ctx.moveTo(width - 8, originPos.y - 4); ctx.lineTo(width, originPos.y); ctx.lineTo(width - 8, originPos.y + 4); }
      if (originPos.x >= -20 && originPos.x <= width + 20) { ctx.moveTo(originPos.x, 0); ctx.lineTo(originPos.x, height); ctx.moveTo(originPos.x - 4, 8); ctx.lineTo(originPos.x, 0); ctx.lineTo(originPos.x + 4, 8); } ctx.stroke();
      if (!math) return;
      const scope = createMathScope(params, calculatedPoints, activeAnalyses, functions);
      functions.forEach(f => {
          if (!f.visible || !f.expression || f.type === 'empty') return;
          const drawFuncPath = (c: CanvasRenderingContext2D) => {
              c.beginPath(); c.strokeStyle = f.color; c.lineWidth = f.lineWidth || 2; if (f.lineStyle === 'dashed') c.setLineDash([5, 5]); else if (f.lineStyle === 'dotted') c.setLineDash([2, 3]); else c.setLineDash([]);
              let labelPos: {x: number, y: number} | null = null;
              try {
                  if (f.type === 'function') {
                      const code = math.compile(f.expression); let rMin = -Infinity, rMax = Infinity; if (f.rangeMin) try { rMin = math.evaluate(f.rangeMin, scope); } catch {} if (f.rangeMax) try { rMax = math.evaluate(f.rangeMax, scope); } catch {}
                      let first = true, prevY: number | null = null; const labelCheckX = screenToWorld({x: width * 0.85, y: 0}, {view, width, height}).x;
                      for (let px = 0; px <= width; px += 2) {
                          const wx = s2w(px, 0).x; if (wx < rMin || wx > rMax) { first = true; continue; }
                          try { const wy = code.evaluate({ ...scope, x: wx }); if (isNaN(wy) || !isFinite(wy)) { first = true; continue; } const s = w2s(wx, wy); if (!first && prevY !== null && Math.abs(s.y - prevY) > height) first = true; if (first) { c.moveTo(s.x, s.y); first = false; } else c.lineTo(s.x, s.y); prevY = s.y; if (c === ctx && !labelPos && wx >= labelCheckX && s.y > 20 && s.y < height - 20) labelPos = { x: s.x, y: s.y }; } catch { first = true; }
                      } c.stroke();
                  } else if (f.type === 'vertical') { const val = math.evaluate(f.expression, scope), s = w2s(val, 0); c.beginPath(); c.moveTo(s.x, 0); c.lineTo(s.x, height); c.stroke(); if (c === ctx) labelPos = { x: s.x, y: 30 }; }
                  else if (f.type === 'implicit' || f.type === 'inequality') {
                      let expr = f.expression, operator = '', isInequality = f.type === 'inequality';
                      if (isInequality) { const opMatch = expr.match(/([<>]=?)/); if (opMatch) { operator = opMatch[0]; const parts = expr.split(operator); if (parts.length === 2) expr = `(${parts[0]}) - (${parts[1]})`; } }
                      else if (expr.includes('=') && !expr.match(/[<>]/)) { const parts = expr.split('='); expr = `(${parts[0]}) - (${parts[1]})`; }
                      const code = math.compile(expr), res = 8, cols = Math.ceil(width / res) + 1, rows = Math.ceil(height / res) + 1, gridValues = new Float32Array(cols * rows);
                      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const w = s2w(x * res, y * res); try { let v = code.evaluate({ ...scope, x: w.x, y: w.y }); gridValues[y * cols + x] = isNaN(v) ? NaN : v; } catch { gridValues[y * cols + x] = NaN; } }
                      const isInside = (v: number) => !isNaN(v) && (operator.includes('<') ? v < 0 : (operator.includes('>') ? v > 0 : v > 0));
                      if (isInequality) {
                          c.beginPath(); for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols - 1; x++) {
                              const k = y * cols + x, v0 = gridValues[k], v1 = gridValues[k + 1], v2 = gridValues[k + cols + 1], v3 = gridValues[k + cols]; if (isNaN(v0) || isNaN(v1) || isNaN(v2) || isNaN(v3)) continue;
                              const caseIdx = (isInside(v0)?1:0) | (isInside(v1)?2:0) | (isInside(v2)?4:0) | (isInside(v3)?8:0); if (caseIdx === 0) continue;
                              const x0 = x * res, y0 = y * res, lerp = (a: number, b: number) => Math.abs(b-a) < 1e-9 ? 0.5 : -a / (b-a), pT = { x: x0 + lerp(v0, v1) * res, y: y0 }, pR = { x: x0 + res, y: y0 + lerp(v1, v2) * res }, pB = { x: x0 + lerp(v3, v2) * res, y: y0 + res }, pL = { x: x0, y: y0 + lerp(v0, v3) * res, y0 }, TL = { x: x0, y: y0 }, TR = { x: x0 + res, y: y0 }, BR = { x: x0 + res, y: y0 + res }, BL = { x: x0, y: y0 + res }, poly = (pts: any[]) => { c.moveTo(pts[0].x, pts[0].y); for(let i=1; i<pts.length; i++) c.lineTo(pts[i].x, pts[i].y); c.closePath(); };
                              switch(caseIdx) { case 1: poly([TL, pT, pL]); break; case 2: poly([TR, pR, pT]); break; case 3: poly([TL, TR, pR, pL]); break; case 4: poly([pR, BR, pB]); break; case 5: poly([TL, pT, pL]); poly([pR, BR, pB]); break; case 6: poly([TR, BR, pB, pT]); break; case 7: poly([TL, TR, BR, pB, pL]); break; case 8: poly([pL, pB, BL]); break; case 9: poly([TL, pT, pB, BL]); break; case 10: poly([TR, pR, pT]); poly([pL, pB, BL]); break; case 11: poly([TL, TR, pR, pB, BL]); break; case 12: poly([pL, pR, BR, BL]); break; case 13: poly([TL, pT, pR, BR, BL]); break; case 14: poly([pT, TR, BR, BL, pL]); break; case 15: poly([TL, TR, BR, BL]); break; }
                          } c.fillStyle = hexToRgba(f.color, 0.2); c.fill();
                      }
                      c.beginPath(); if (isInequality && (operator === '<' || operator === '>')) c.setLineDash([5, 5]); else c.setLineDash([]);
                      for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols - 1; x++) {
                          const k = y * cols + x, v0 = gridValues[k], v1 = gridValues[k+1], v2 = gridValues[k+cols+1], v3 = gridValues[k+cols]; if (isNaN(v0) || isNaN(v1) || isNaN(v2) || isNaN(v3)) continue;
                          const check = isInequality ? isInside : (v: number) => v > 0, caseIdx = (check(v0)?1:0) | (check(v1)?2:0) | (check(v2)?4:0) | (check(v3)?8:0); if (caseIdx === 0 || caseIdx === 15) continue;
                          const x0 = x * res, y0 = y * res, lerp = (a: number, b: number) => Math.abs(b-a) < 1e-9 ? 0.5 : -a / (b-a), pT = { x: x0 + lerp(v0, v1) * res, y: y0 }, pR = { x: x0 + res, y: y0 + lerp(v1, v2) * res }, pB = { x: x0 + lerp(v3, v2) * res, y: y0 + res }, pL = { x: x0, y: y0 + lerp(v0, v3) * res }, line = (pA: any, pB: any) => { c.moveTo(pA.x, pA.y); c.lineTo(pB.x, pB.y); };
                          switch(caseIdx) { case 1: line(pL, pT); break; case 2: line(pT, pR); break; case 3: line(pL, pR); break; case 4: line(pR, pB); break; case 5: line(pL, pT); line(pR, pB); break; case 6: line(pT, pB); break; case 7: line(pL, pB); break; case 8: line(pL, pB); break; case 9: line(pB, pT); break; case 10: line(pB, pR); line(pT, pL); break; case 11: line(pB, pR); break; case 12: line(pR, pL); break; case 13: line(pR, pT); break; case 14: line(pT, pL); break; }
                      } c.stroke();
                  }
              } catch (e) {} c.setLineDash([]); return labelPos;
          };
          const labelPos = drawFuncPath(ctx); if (f.trace && traceCtx) drawFuncPath(traceCtx);
          if (labelPos) { ctx.save(); ctx.font = `italic bold ${fontSize}px serif`; ctx.fillStyle = f.color; ctx.shadowColor = "white"; ctx.shadowBlur = 4; ctx.lineWidth = 3; ctx.strokeStyle = "white"; ctx.strokeText(f.name, labelPos.x + 8, labelPos.y - 8); ctx.fillText(f.name, labelPos.x + 8, labelPos.y - 8); ctx.restore(); }
      });
      activeAnalyses.forEach(an => {
          if (an.visible === false) return;
          try {
              if (an.type === 'polygon' && an.vertices && an.vertices.length >= 3) {
                 const pts = an.vertices.map(id => { const cp = displayPoints.find(x => String(x.id) === String(id)); return cp ? {x: cp.x, y: cp.y} : null; }).filter(Boolean) as {x:number, y:number}[];
                 if (pts.length > 2) {
                     const drawPoly = (c: CanvasRenderingContext2D) => { c.beginPath(); const s0 = w2s(pts[0].x, pts[0].y); c.moveTo(s0.x, s0.y); pts.slice(1).forEach(p => { const s = w2s(p.x, p.y); c.lineTo(s.x, s.y); }); c.closePath(); c.fillStyle = hexToRgba(an.color || '#4f46e5', 0.2); c.fill(); c.strokeStyle = an.color || '#4f46e5'; c.lineWidth = an.lineWidth || 1.5; if (an.lineStyle === 'dashed') c.setLineDash([5, 5]); else if (an.lineStyle === 'dotted') c.setLineDash([2, 3]); else c.setLineDash([]); c.stroke(); c.setLineDash([]); };
                     drawPoly(ctx); if (an.trace && traceCtx) drawPoly(traceCtx);
                 }
              }
              if ((an.type === 'line' || an.type === 'ray' || an.type === 'segment') && an.vertices && an.vertices.length === 2) {
                 const v1 = displayPoints.find(p => String(p.id) === String(an.vertices![0])), v2 = displayPoints.find(p => String(p.id) === String(an.vertices![1]));
                 if (v1 && v2) {
                     const drawLine = (c: CanvasRenderingContext2D) => { c.beginPath(); c.strokeStyle = an.color || '#000'; c.lineWidth = an.lineWidth || 1.5; if (an.lineStyle === 'dashed') c.setLineDash([5, 5]); else if (an.lineStyle === 'dotted') c.setLineDash([2, 3]); const m = (v2.y - v1.y) / (v2.x - v1.x), b = v1.y - m * v1.x; if (an.type === 'segment') { const s1 = w2s(v1.x, v1.y), s2 = w2s(v2.x, v2.y); c.moveTo(s1.x, s1.y); c.lineTo(s2.x, s2.y); } else if (Math.abs(v2.x - v1.x) < 1e-9) { const s = w2s(v1.x, 0); c.moveTo(s.x, 0); c.lineTo(s.x, height); } else { const leftY = m * tl.x + b, rightY = m * br.x + b, sStart = w2s(tl.x, leftY), sEnd = w2s(br.x, rightY); if (an.type === 'ray') { const sV1 = w2s(v1.x, v1.y); c.moveTo(sV1.x, sV1.y); if (v2.x >= v1.x) c.lineTo(sEnd.x, sEnd.y); else c.lineTo(sStart.x, sStart.y); } else { c.moveTo(sStart.x, sStart.y); c.lineTo(sEnd.x, sEnd.y); } } c.stroke(); c.setLineDash([]); };
                     drawLine(ctx); if (an.trace && traceCtx) drawLine(traceCtx);
                 }
              }
              if (an.type === 'tangent_analysis' && an.funcId) {
                 const f = functions.find(fn => fn.id === an.funcId); let x = an.x; if (an.vertices && an.vertices.length > 0) { const refPoint = displayPoints.find(p => String(p.id) === String(an.vertices![0])); if (refPoint) x = refPoint.x; }
                 if (f && f.visible && x !== undefined) {
                     try {
                         const y = math.evaluate(f.expression, { ...scope, x: x }), h = 0.0001, y2 = math.evaluate(f.expression, { ...scope, x: x + h }), m = (y2 - y) / h, b = y - m * x;
                         const drawTangent = (c: CanvasRenderingContext2D) => { c.beginPath(); c.strokeStyle = an.color || '#64748b'; c.lineWidth = an.lineWidth || 1.5; if (an.lineStyle === 'dashed') c.setLineDash([5, 5]); else if (an.lineStyle === 'dotted') c.setLineDash([2, 3]); const sStart = w2s(tl.x, m * tl.x + b), sEnd = w2s(br.x, m * br.x + b); c.moveTo(sStart.x, sStart.y); c.lineTo(sEnd.x, sEnd.y); c.stroke(); c.setLineDash([]); const sPt = w2s(x!, y); c.beginPath(); c.arc(sPt.x, sPt.y, 4, 0, Math.PI * 2); c.fillStyle = an.color || '#64748b'; c.fill(); };
                         drawTangent(ctx); if (an.trace && traceCtx) drawTangent(traceCtx);
                     } catch(e) {}
                 }
              }
          } catch(e) {}
      });
      displayPoints.forEach(pt => {
          const parentAnalysis = activeAnalyses[pt.analysisIndex]; if (parentAnalysis && parentAnalysis.visible === false) return;
          if (pt.isLabelAnchor) return; const s = w2s(pt.x, pt.y);
          const drawPoint = (c: CanvasRenderingContext2D) => { c.beginPath(); const r = pt.size || 5; if (pt.pointStyle === 'cross') { c.moveTo(s.x - r, s.y - r); c.lineTo(s.x + r, s.y + r); c.moveTo(s.x + r, s.y - r); c.lineTo(s.x - r, s.y + r); } else { c.arc(s.x, s.y, r, 0, Math.PI * 2); if (pt.pointStyle === 'open') { c.fillStyle = 'white'; c.fill(); } else { c.fillStyle = pt.color || '#4f46e5'; c.fill(); } } c.strokeStyle = pt.color || '#4f46e5'; c.lineWidth = 2; c.stroke(); };
          drawPoint(ctx); if (pt.trace && traceCtx) drawPoint(traceCtx);
      });
      if (activeTool === 'polygon' && polygonBuilder.length > 1) { ctx.beginPath(); ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); for (let i = 0; i < polygonBuilder.length - 1; i++) { let p1 = displayPoints.find(p => String(p.id) === String(polygonBuilder[i])), p2 = displayPoints.find(p => String(p.id) === String(polygonBuilder[i+1])); if (p1 && p2) { const s1 = w2s(p1.x, p1.y), s2 = w2s(p2.x, p2.y); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); } } ctx.stroke(); ctx.setLineDash([]); }
      if (mousePos && (activeTool === 'line' || activeTool === 'ray' || activeTool === 'segment' || activeTool === 'polygon')) { let startPt: {x: number, y: number} | null = null; const id = lineBuilder || (polygonBuilder.length ? polygonBuilder[polygonBuilder.length - 1] : null); if (id) { const c = displayPoints.find(x => String(x.id) === id); if(c) startPt={x:c.x, y:c.y}; } if (startPt) { const s = w2s(startPt.x, startPt.y); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(mousePos.x, mousePos.y); ctx.strokeStyle = '#9ca3af'; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]); } }
  }, [size, view, functions, params, activeAnalyses, displayPoints, activeTool, polygonBuilder, lineBuilder, mousePos, hasTrigFunctions, fontSize, precision]);

  useEffect(() => { draw(); }, [draw]);

  const onInteractionStart = (clientX: number, clientY: number, prevent: () => void) => {
    if (onCanvasInteraction) onCanvasInteraction();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect(), x = clientX - rect.left, y = clientY - rect.top;
    let wCoords = screenToWorld({x, y}, {view, width: size.width, height: size.height});

    if (activeTool === 'move') {
      const hit = getClosestObject(x, y);
      if (hit && hit.type === 'analysis') { 
          const obj = activeAnalyses.find(a => String(a.id) === String(hit.id)); 
          if (obj && (obj.type === 'freePoint' || obj.type === 'pointOn_analysis')) { 
              setDraggingPointIndex(activeAnalyses.indexOf(obj)); 
              setIsDragging(true); 
              return; 
          } 
      }
      setIsDragging(true); setDragStart({ x: clientX, y: clientY });
    } else if (activeTool === 'eraser') {
        const hit = getClosestObject(x, y);
        if (hit) {
            if (hit.type === 'analysis' && onRemoveAnalysis) onRemoveAnalysis(String(hit.id));
            else if (hit.type === 'function' && onRemoveFunction) onRemoveFunction(Number(hit.id));
        }
    } else if (activeTool === 'freePoint') { 
        const tl = screenToWorld({x: 0, y: 0}, {view, width: size.width, height: size.height}), br = screenToWorld({x: size.width, y: size.height}, {view, width: size.width, height: size.height});
        let stepX = 1; const roughStepX = Math.abs(br.x - tl.x) / 10, magX = Math.pow(10, Math.floor(Math.log10(roughStepX))); stepX = Math.max(magX * (roughStepX / magX < 2 ? 1 : roughStepX / magX < 5 ? 2 : 5), 1e-10); if (hasTrigFunctions) { stepX = Math.PI / 2; if (view.scaleX < 20) stepX = Math.PI * 2; }
        const roughStepY = Math.abs(tl.y - br.y) / 10, magY = Math.pow(10, Math.floor(Math.log10(roughStepY))), stepY = Math.max(magY * (roughStepY / magY < 2 ? 1 : roughStepY / magY < 5 ? 2 : 5), 1e-10);
        
        const snapX = Math.round(wCoords.x / stepX) * stepX, snapY = Math.round(wCoords.y / stepY) * stepY;
        const sSnap = worldToScreen({x: snapX, y: snapY}, {view, width: size.width, height: size.height});
        if (Math.hypot(sSnap.x - x, sSnap.y - y) < 12) wCoords = { x: snapX, y: snapY };

        const id = Date.now().toString(), label = getNextPointLabel(activeAnalyses.map(a => a.label || '')); 
        setActiveAnalyses(prev => [...prev, { id, type: 'freePoint', x: wCoords.x, y: wCoords.y, label, color: '#4f46e5', visible: true }]); 
        onHistoryCommit(); 
    }
    else if (['line', 'ray', 'segment'].includes(activeTool)) {
        const hit = getClosestObject(x, y); let targetId = hit?.type === 'analysis' ? String(hit.id) : Date.now().toString();
        if (hit?.type !== 'analysis') { 
            const label = getNextPointLabel(activeAnalyses.map(a => a.label || '')); 
            setActiveAnalyses(prev => [...prev, { id: targetId, type: 'freePoint', x: wCoords.x, y: wCoords.y, label, color: '#4f46e5', visible: true }]); 
        }
        if (!lineBuilder) setLineBuilder(targetId);
        else { const label = getNextLineLabel(activeAnalyses.map(a => a.label || '')); setActiveAnalyses(prev => [...prev, { id: Date.now().toString(), type: activeTool as any, vertices: [lineBuilder, targetId], label, color: '#000000', visible: true }]); setLineBuilder(null); onHistoryCommit(); }
    } else if (activeTool === 'polygon') {
         const hit = getClosestObject(x, y); let targetId = hit?.type === 'analysis' ? String(hit.id) : Date.now().toString();
         if (hit?.type !== 'analysis') { const label = getNextPointLabel(activeAnalyses.map(a => a.label || '')); setActiveAnalyses(prev => [...prev, { id: targetId, type: 'freePoint', x: wCoords.x, y: wCoords.y, label, color: '#4f46e5', visible: true }]); }
         if (polygonBuilder.length > 0 && targetId === polygonBuilder[0]) { setActiveAnalyses(prev => [...prev, { id: Date.now().toString(), type: 'polygon', vertices: [...polygonBuilder], label: `Poly${activeAnalyses.filter(a => a.type === 'polygon').length + 1}`, color: '#4f46e5', visible: true }]); setPolygonBuilder([]); onHistoryCommit(); }
         else setPolygonBuilder(prev => [...prev, targetId]);
    } else if (activeTool === 'tangent') {
        const hit = getClosestObject(x, y);
        if (hit && hit.type === 'function') { setActiveAnalyses(prev => [...prev, { id: Date.now().toString(), type: 'tangent_analysis', funcId: Number(hit.id), x: wCoords.x, label: getNextLineLabel(activeAnalyses.map(a => a.label || '')), color: '#000000', visible: true }]); onHistoryCommit(); }
        else if (hit && hit.type === 'analysis') { const obj = activeAnalyses.find(a => String(a.id) === String(hit.id)); if (obj && obj.type === 'pointOn_analysis' && obj.funcId) { setActiveAnalyses(prev => [...prev, { id: Date.now().toString(), type: 'tangent_analysis', funcId: obj.funcId, vertices: [String(obj.id)], label: getNextLineLabel(activeAnalyses.map(a => a.label || '')), color: '#000000', visible: true }]); onHistoryCommit(); } }
    } else if (['zeros', 'min', 'max'].includes(activeTool)) {
        const hit = getClosestObject(x, y); if (hit && hit.type === 'function') { setActiveAnalyses(prev => [...prev, { id: Date.now().toString(), type: 'func_analysis', subtype: activeTool as any, funcId: Number(hit.id), x: wCoords.x, label: activeTool === 'zeros' ? 'R' : (activeTool === 'min' ? 'Min' : 'Max'), color: '#4f46e5', visible: true }]); onHistoryCommit(); }
    } else if (activeTool === 'intersect' || activeTool === 'intersectObjects') {
        const hit = getClosestObject(x, y); if (hit && hit.type === 'function') { if (!lineBuilder) setLineBuilder(String(hit.id)); else if (String(hit.id) !== lineBuilder) { setActiveAnalyses(prev => [...prev, { id: Date.now().toString(), type: 'intersection_analysis', funcId: Number(lineBuilder), funcId2: Number(hit.id), x: wCoords.x, label: 'I', color: '#4f46e5', visible: true }]); setLineBuilder(null); onHistoryCommit(); } }
    } else if (activeTool === 'pointOn') {
        const hit = getClosestObject(x, y); if (hit && hit.type === 'function') { setActiveAnalyses(prev => [...prev, { id: Date.now().toString(), type: 'pointOn_analysis', funcId: Number(hit.id), x: wCoords.x, label: getNextPointLabel(activeAnalyses.map(a => a.label || '')), color: '#4f46e5', visible: true }]); onHistoryCommit(); }
    }
  };

  const onInteractionMove = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect(), x = clientX - rect.left, y = clientY - rect.top; setMousePos({ x, y });
    if (activeTool === 'move' && isDragging) {
       if (draggingPointIndex !== null) {
           let wCoords = screenToWorld({x, y}, {view, width: size.width, height: size.height});
           const obj = activeAnalyses[draggingPointIndex];

           if (obj.type === 'freePoint') {
               const tl = screenToWorld({x: 0, y: 0}, {view, width: size.width, height: size.height}), br = screenToWorld({x: size.width, y: size.height}, {view, width: size.width, height: size.height});
               let stepX = 1; const roughStepX = Math.abs(br.x - tl.x) / 10, magX = Math.pow(10, Math.floor(Math.log10(roughStepX))); stepX = Math.max(magX * (roughStepX / magX < 2 ? 1 : roughStepX / magX < 5 ? 2 : 5), 1e-10); if (hasTrigFunctions) { stepX = Math.PI / 2; if (view.scaleX < 20) stepX = Math.PI * 2; }
               const roughStepY = Math.abs(tl.y - br.y) / 10, magY = Math.pow(10, Math.floor(Math.log10(roughStepY))), stepY = Math.max(magY * (roughStepY / magY < 2 ? 1 : roughStepY / magY < 5 ? 2 : 5), 1e-10);
               
               const snapX = Math.round(wCoords.x / stepX) * stepX, snapY = Math.round(wCoords.y / stepY) * stepY;
               const sSnap = worldToScreen({x: snapX, y: snapY}, {view, width: size.width, height: size.height});
               
               if (Math.hypot(sSnap.x - x, sSnap.y - y) < 12) wCoords = { x: snapX, y: snapY };

               setActiveAnalyses(prev => { const next = [...prev]; next[draggingPointIndex] = { ...obj, x: wCoords.x, y: wCoords.y, xExpr: undefined, yExpr: undefined }; return next; });
           }
           else if (obj.type === 'pointOn_analysis') setActiveAnalyses(prev => { const next = [...prev]; next[draggingPointIndex] = { ...obj, x: wCoords.x, xExpr: undefined }; return next; });
       } else {
           const dx = clientX - dragStart.x, dy = clientY - dragStart.y; setView(prev => ({ ...prev, x: prev.x - dx / prev.scaleX, y: prev.y + dy / prev.scaleY })); setDragStart({ x: clientX, y: clientY });
       }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => onInteractionStart(e.clientX, e.clientY, () => e.preventDefault());
  const handleMouseMove = (e: React.MouseEvent) => onInteractionMove(e.clientX, e.clientY);
  const handleMouseUp = () => { if (activeTool === 'move' && isDragging && draggingPointIndex !== null) onHistoryCommit(); setIsDragging(false); setDraggingPointIndex(null); };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
        onInteractionStart(e.touches[0].clientX, e.touches[0].clientY, () => e.preventDefault());
        if (isDragging || activeTool !== 'move') e.preventDefault();
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
        onInteractionMove(e.touches[0].clientX, e.touches[0].clientY);
        if (isDragging) e.preventDefault();
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => handleMouseUp();

  const handleCanvasDoubleClick = (e: React.MouseEvent | React.TouchEvent) => { 
    if (onCanvasInteraction) onCanvasInteraction(); 
    if (activeTool !== 'move') return; 
    const rect = canvasRef.current?.getBoundingClientRect(); 
    if (!rect) return;
    const clientX = 'clientX' in e ? e.clientX : (e as React.TouchEvent).touches[0]?.clientX;
    const clientY = 'clientY' in e ? e.clientY : (e as React.TouchEvent).touches[0]?.clientY;
    if (clientX === undefined) return;
    const hit = getClosestObject(clientX - rect.left, clientY - rect.top); 
    if (hit && onObjectDoubleClick) onObjectDoubleClick(hit.id, hit.type); 
  };
  
  const handleCanvasContextMenu = (e: React.MouseEvent) => { e.preventDefault(); if (activeTool !== 'move') return; const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return; const hit = getClosestObject(e.clientX - rect.left, e.clientY - rect.top); if (hit && onObjectContextMenu) onObjectContextMenu(hit.id, hit.type, e.clientX, e.clientY); };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault(); 
    const rect = canvasRef.current?.getBoundingClientRect(); 
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wheel = e.deltaY < 0 ? 1.02 : 0.98;
    const worldPos = screenToWorld({x: mx, y: my}, {view, width: size.width, height: size.height});
    const nSX = view.scaleX * wheel, nSY = view.scaleY * wheel;
    setView({ x: worldPos.x - (mx - size.width / 2) / nSX, y: worldPos.y + (my - size.height / 2) / nSY, scaleX: nSX, scaleY: nSY });
  };

  return (
      <div className="flex-1 relative overflow-hidden bg-white cursor-crosshair touch-none" ref={containerRef} onDoubleClick={handleCanvasDoubleClick} onContextMenu={handleCanvasContextMenu}>
          <canvas ref={traceCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <canvas 
            ref={canvasRef} 
            className={`w-full h-full block ${activeTool === 'move' ? 'cursor-move' : (activeTool === 'eraser' ? 'cursor-no-drop' : '')}`} 
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          />
          <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
              <button onClick={() => setView(prev => ({ ...prev, scaleX: prev.scaleX * 1.2, scaleY: prev.scaleY * 1.2 }))} className="bg-white p-2 rounded shadow hover:bg-gray-100 text-[#007888]" title="Zoom In"><Icons.IconZoomIn /></button>
              <button onClick={() => setView(prev => ({ ...prev, scaleX: prev.scaleX / 1.2, scaleY: prev.scaleY / 1.2 }))} className="bg-white p-2 rounded shadow hover:bg-gray-100 text-[#007888]" title="Zoom Out"><Icons.IconZoomOut /></button>
              <button onClick={() => setView({ x: 0, y: 0, scaleX: 50, scaleY: 50 })} className="bg-white p-2 rounded shadow hover:bg-gray-100 text-[#007888]" title="Reset View"><Icons.IconHome /></button>
              <button onClick={() => { if (canvasRef.current) { const link = document.createElement('a'); link.download = 'graph-calc.png'; link.href = canvasRef.current.toDataURL(); link.click(); } }} className="bg-white p-2 rounded shadow hover:bg-gray-100 text-[#007888]" title="Screenshot"><Icons.IconCamera /></button>
          </div>
          {axisTicks.xTicks.map(t => {
              const katex = (window as any).katex; if (!katex) return null;
              return (<div key={t.id} style={{position: 'absolute', left: t.x, top: t.y, transform: 'translateX(-50%)', pointerEvents: 'none', fontSize: `${fontSize}px`, color: '#475569', userSelect: 'none'}}><span dangerouslySetInnerHTML={{__html: katex.renderToString(t.latex, { throwOnError: false })}} /></div>)
          })}
          {axisTicks.yTicks.map(t => {
              const katex = (window as any).katex; if (!katex) return null;
              return (<div key={t.id} style={{position: 'absolute', left: t.x, top: t.y, transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: `${fontSize}px`, color: '#475569', userSelect: 'none', display: 'flex', justifyContent: t.align, width: '40px', marginLeft: t.align === 'flex-start' ? '0' : '-40px'}}><span dangerouslySetInnerHTML={{__html: katex.renderToString(t.latex, { throwOnError: false })}} /></div>)
          })}
          {(() => {
              const katex = (window as any).katex; if (!katex) return null;
              return (
                  <>
                      <div style={{position: 'absolute', left: size.width - 25, top: origin.y - 25, pointerEvents: 'none', color: '#1e293b', fontWeight: 'bold', fontSize: `${fontSize + 2}px`, visibility: (origin.y > -20 && origin.y < size.height + 20) ? 'visible' : 'hidden'}}><span dangerouslySetInnerHTML={{__html: katex.renderToString(axisLabels.x, { throwOnError: false })}} /></div>
                      <div style={{position: 'absolute', left: origin.x + 10, top: 10, pointerEvents: 'none', color: '#1e293b', fontWeight: 'bold', fontSize: `${fontSize + 2}px`, visibility: (origin.x > -20 && origin.x < size.width + 20) ? 'visible' : 'hidden'}}><span dangerouslySetInnerHTML={{__html: katex.renderToString(axisLabels.y, { throwOnError: false })}} /></div>
                  </>
              )
          })()}
          {displayPoints.map(pt => {
              if (!pt.latex) return null; const s = worldToScreen({x: pt.x, y: pt.y}, {view, width: size.width, height: size.height}), offset = labelOffsets[pt.id] || { x: 15, y: -15 };
              const katex = (window as any).katex; if (!katex) return null;
              return (<React.Fragment key={pt.id}>{(Math.abs(offset.x) > 25 || Math.abs(offset.y) > 25) && (<svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible"><line x1={s.x} y1={s.y} x2={s.x + offset.x} y2={s.y + offset.y} stroke="#6b7280" strokeWidth="1" strokeDasharray="3,3" /></svg>)}<div style={{ left: s.x + offset.x, top: s.y + offset.y, position: 'absolute', transform: `translate(${offset.x < 0 ? '-100%' : '0%'}, ${offset.y < 0 ? '-100%' : '0%'})`, fontSize: `${fontSize - 2}px` }} className="bg-white/95 backdrop-blur-sm px-2 py-1 rounded shadow border border-gray-300 z-10 text-gray-800 cursor-move pointer-events-auto select-none transition-transform touch-none" onMouseDown={(e) => { e.stopPropagation(); setDraggedLabel({ id: pt.id, startX: e.clientX, startY: e.clientY, startOffsetX: offset.x, startOffsetY: offset.y }); }} onTouchStart={(e) => { e.stopPropagation(); if (e.touches.length > 0) setDraggedLabel({ id: pt.id, startX: e.touches[0].clientX, startY: e.touches[0].clientY, startOffsetX: offset.x, startOffsetY: offset.y }); }} onDoubleClick={(e) => handleLabelDoubleClick(e, pt.id)}><span dangerouslySetInnerHTML={{ __html: katex.renderToString(pt.latex, { throwOnError: false }) }} /></div></React.Fragment>);
          })}
      </div>
  );
};

export default Canvas;
