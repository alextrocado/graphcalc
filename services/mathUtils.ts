
import { ViewPort, MathFunction, MathParam, AnalysisObject, CalculatedPoint } from "../types";

declare const nerdamer: any;
declare const math: any;

export const worldToScreen = (pos: {x: number, y: number}, context: {view: ViewPort, width: number, height: number}) => {
  if (!pos || !context) return { x: 0, y: 0 };
  const { x: wx, y: wy } = pos;
  const { view, width, height } = context;
  const sX = (wx - view.x) * view.scaleX + width / 2;
  const sY = height / 2 - (wy - view.y) * view.scaleY;
  return { x: sX, y: sY };
};

export const screenToWorld = (pos: {x: number, y: number}, context: {view: ViewPort, width: number, height: number}) => {
  if (!pos || !context) return { x: 0, y: 0 };
  const { x: sx, y: sy } = pos;
  const { view, width, height } = context;
  const wX = (sx - width / 2) / view.scaleX + view.x;
  const wY = (height / 2 - sy) / view.scaleY + view.y;
  return { x: wX, y: wY };
};

export const formatNumberDecimal = (num: number, precision = 4) => {
  if (Math.abs(num) < 1e-10) return "0";
  return parseFloat(num.toFixed(precision)).toString();
};

export const sanitizeExpression = (expr: string) => {
    if (!expr) return "";
    let clean = expr.replace(/\bsen\b/g, 'sin').replace(/\braiz\b/g, 'sqrt');
    clean = clean.replace(/log_/g, 'log');
    clean = clean.replace(/log\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, '(log($2)/log($1))');
    clean = clean.replace(/(\d)\s*,\s*(\d)/g, '$1.$2');
    clean = clean.replace(/log(\d+)\s*\(([^)]+)\)/g, '(log($2)/log($1))');
    clean = clean.replace(/\b(x|y)\s*\(\s*([A-Z][\w]*)\s*\)/g, '$1_$2');
    clean = clean.replace(/\b([A-Z][\w]*)\.(x|y)\b/g, '$2_$1');
    clean = clean.replace(/\b(declive|slope)\s*\(\s*([a-z][\w]*)\s*\)/g, 'declive_$2');
    return clean;
};

export const parseInputToNumber = (input: string | undefined, defaultValue = NaN) => {
    if (!input || typeof input !== 'string' || input.trim() === '') return defaultValue;
    try {
        const expression = sanitizeExpression(input.toLowerCase()).replace(/pi/g, 'pi').replace(/e/g, 'e');
        const val = math.evaluate(expression);
        return typeof val === 'number' && isFinite(val) ? val : defaultValue;
    } catch (e) { return defaultValue; }
};

export const analyzeInputType = (input: string) => {
  if (!input || !input.trim()) return { type: 'empty' as const };
  const clean = input.trim();
  
  const labeledVerticalMatch = clean.match(/^([a-zA-Z][\w]*)\s*[:=]\s*x\s*=\s*(.*)$/);
  if (labeledVerticalMatch) {
      return { type: 'vertical' as const, name: labeledVerticalMatch[1], expr: labeledVerticalMatch[2].trim() };
  }

  const pointMatch = clean.match(/^([A-Z][\w]*)\s*[:=]\s*\((.*),(.*)\)$/);
  if (pointMatch) {
      return { type: 'point_assignment' as any, name: pointMatch[1], xExpr: pointMatch[2].trim(), yExpr: pointMatch[3].trim() };
  }

  if (clean.match(/^[a-zA-Z][\w]*'?\s*(?:\([a-zA-Z]\))?\s*=\s*[a-zA-Z][\w]*'\s*(?:\([a-zA-Z]\))?$/i)) {
      return { type: 'function' as const, expr: clean };
  }

  const funcDefMatch = clean.match(/^([a-zA-Z][\w]*'?)\s*\([a-zA-Z]\)\s*([=<>]=?)\s*([^=<>]+)$/);
  if (funcDefMatch) {
      let name = funcDefMatch[1];
      const operator = funcDefMatch[2];
      const expr = funcDefMatch[3].trim();
      if (name.includes("'")) { name = name.replace(/'/g, "_prime"); }
      const isInequality = operator !== '=' || expr.match(/[<>]/);
      const isImplicit = expr.includes('=') && !isInequality;
      
      if (isImplicit) return { type: 'implicit' as const, expr: expr, name: name };
      return { type: isInequality ? 'inequality' as const : 'function' as const, expr: expr, name: name, operator: operator };
  }

  const inequalityMatch = clean.match(/([<>]=?)/);
  if (inequalityMatch && !clean.includes('=')) {
      return { type: 'inequality' as const, operator: inequalityMatch[0] };
  }
  
  if (/^x\s*=\s*[^=]+$/.test(clean) && !clean.includes('y')) {
       return { type: 'vertical' as const, expr: clean.split('=')[1].trim() };
  }
  
  if (/^y\s*=\s*[^=]+$/.test(clean) && !clean.includes('x^') && !clean.includes('y^')) {
       return { type: 'function' as const, expr: clean.split('=')[1].trim() };
  }
  
  const assignMatch = clean.match(/^([a-zA-Z][\w]*)\s*[:=]\s*([^=]+)$/);
  if (assignMatch) {
      const lhs = assignMatch[1];
      const rhs = assignMatch[2].trim();
      const geomDerivMatch = rhs.match(/^(declive|slope|x|y)\s*\(\s*([a-zA-Z][\w]*)\s*\)$/i);
      if (geomDerivMatch) {
          return { type: 'geometric_assignment' as any, name: lhs, prop: geomDerivMatch[1].toLowerCase(), targetLabel: geomDerivMatch[2] };
      }
      const containsVariables = /\b(x|y)\b/.test(rhs);
      if (lhs !== 'x' && lhs !== 'y' && !containsVariables) {
          return { type: 'parameter' as any, name: lhs, expr: rhs };
      }
      return { type: 'implicit' as const, expr: rhs, name: lhs }; 
  }

  if (clean.includes('=') || clean.match(/[<>]/)) {
      return { type: clean.match(/[<>]/) ? 'inequality' : 'implicit', expr: clean };
  }
  
  return { type: 'function' as const, expr: input };
};

export const hexToRgba = (hex: string, alpha: number) => {
  let c: any;
  if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
      c= hex.substring(1).split('');
      if(c.length== 3){ c= [c[0], c[0], c[1], c[1], c[2], c[2]]; }
      c= '0x'+c.join('');
      return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
  }
  return `rgba(79, 70, 229, ${alpha})`;
};

export const formatNumberToLatex = (num: number, precision?: number) => {
    const epsilon = 0.001; 
    if (Math.abs(num) < epsilon) return "0";
    if (Math.abs(num - Math.round(num)) < epsilon) return Math.round(num).toString();
    const denoms = [1, 2, 3, 4, 5, 6, 8, 10, 12, 24];
    for (let denom of denoms) {
         const ratio = num * denom / Math.PI;
         if (Math.abs(ratio - Math.round(ratio)) < epsilon) {
             const n = Math.round(ratio);
             if (n === 0) return "0";
             let numStr = Math.abs(n) === 1 ? "\\pi" : `${Math.abs(n)}\\pi`;
             let sign = n < 0 ? "-" : "";
             if (denom === 1) return `${sign}${numStr}`;
             return `${sign}\\frac{${numStr}}{${denom}}`;
         }
    }
    try {
        const frac = math.fraction(num);
        if (frac.d < 20 && Math.abs(frac.n) < 1000) return frac.d === 1 ? frac.n.toString() : `\\frac{${frac.n}}{${frac.d}}`;
    } catch (e) {}
    return parseFloat(num.toFixed(precision !== undefined ? precision : 4)).toString();
};

export const getBestLatex = (valNum: number, rawSymbolic: string, precision?: number) => {
    const heuristic = formatNumberToLatex(valNum, precision);
    if (heuristic.includes('\\') || heuristic.includes('pi')) return heuristic;
    if (rawSymbolic && rawSymbolic.length < 20 && !rawSymbolic.match(/\d{5,}/)) return rawSymbolic;
    return heuristic; 
};

export const solveClosest = (expression: string, type: 'zeros' | 'min' | 'max', targetX: number, params: MathParam[], precision: number = 2, scope: any = {}) => {
    try {
        const cleanExpr = sanitizeExpression(expression);
        const compiled = math.compile(cleanExpr);
        const f = (x: number) => { try { return compiled.evaluate({ ...scope, ...params.reduce((acc:any,p)=>({...acc,[p.name]:p.value}),{}), x }); } catch { return NaN; } };
        const h = 1e-5;
        let g: (x: number) => number;
        if (type === 'zeros') { g = f; } else { g = (x: number) => (f(x + h) - f(x - h)) / (2 * h); }
        let currentX = targetX; let found = false;
        for (let i = 0; i < 30; i++) {
            const y = g(currentX);
            if (isNaN(y)) break;
            if (Math.abs(y) < 1e-7) { found = true; break; }
            const yPlus = g(currentX + h); const yMinus = g(currentX - h);
            const dg = (yPlus - yMinus) / (2 * h);
            if (Math.abs(dg) < 1e-9) break; 
            const nextX = currentX - y / dg;
            if (Math.abs(nextX - currentX) < 1e-9) { currentX = nextX; found = true; break; }
            if (Math.abs(nextX) > 1e6) break;
            currentX = nextX;
        }
        if (found || Math.abs(g(currentX)) < 1e-3) {
             const yVal = f(currentX);
             if (type === 'min' || type === 'max') {
                 const f_prime_prime = (f(currentX + h) - 2*f(currentX) + f(currentX - h)) / (h*h);
                 if (type === 'max' && f_prime_prime > 1e-5) return null; 
                 if (type === 'min' && f_prime_prime < -1e-5) return null;
             }
             const lx = getBestLatex(currentX, "", precision);
             const ly = getBestLatex(yVal, "", precision);
             let labelTex = "";
             if (type === 'zeros') labelTex = `P(${lx}, 0)`;
             else if (type === 'max') labelTex = `\\text{Max}(${lx}, ${ly})`;
             else labelTex = `\\text{Min}(${lx}, ${ly})`;
             return { x: currentX, y: yVal, latex: labelTex };
        }
        return null;
    } catch(e) { return null; }
};

export const solveSymbolic = (expression: string, type: 'zeros' | 'min' | 'max', params: any[], precision: number = 2) => {
  try {
      let exprWithParams = sanitizeExpression(expression);
      params.forEach(p => { const regex = new RegExp(`\\b${p.name}\\b`, 'g'); exprWithParams = exprWithParams.replace(regex, `(${p.value})`); });
      let solutions: any[] = [];
      const processRoots = (rootList: any, labelFn: (x: number, y: number, lx: string, ly: string) => string | null) => {
          const results: any[] = [];
          let roots: string[] = [];
          if (Array.isArray(rootList)) { roots = rootList; } else { roots = rootList.toString().replace(/[\[\]]/g, '').split(','); }
          roots.forEach((rootStr: string) => {
              if (!rootStr) return;
              try {
                  const node = nerdamer(rootStr);
                  const xVal = parseFloat(node.evaluate().text('decimals'));
                  if (!isNaN(xVal) && isFinite(xVal)) {
                      let yVal = 0; let yLatex = "0";
                      if (type !== 'zeros') {
                          const yExpr = exprWithParams.replace(/x/g, `(${rootStr})`);
                          const yNode = nerdamer(yExpr);
                          yVal = parseFloat(yNode.evaluate().text('decimals'));
                          yLatex = getBestLatex(yVal, yNode.toTeX(), precision);
                      }
                      const xLatex = getBestLatex(xVal, node.toTeX(), precision);
                      const label = labelFn(xVal, yVal, xLatex, yLatex);
                      if (label) results.push({ x: xVal, y: yVal, latex: label });
                  }
              } catch(e) {}
          });
          return results;
      };
      if (type === 'zeros') {
          const sol = nerdamer.solve(exprWithParams, 'x');
          solutions = processRoots(sol, (x, y, lx, ly) => `P(${lx}, 0)`);
      } else if (type === 'min' || type === 'max') {
          const derivative = nerdamer(`diff(${exprWithParams}, x)`);
          const critRoots = nerdamer.solve(derivative.toString(), 'x');
          solutions = processRoots(critRoots, (x, y, lx, ly) => {
              try {
                  const secondDeriv = nerdamer(`diff(${derivative.toString()}, x)`);
                  const concStr = nerdamer(secondDeriv.toString().replace(/x/g, `(${x})`)).evaluate().text('decimals');
                  const conc = parseFloat(concStr);
                  if (type === 'max' && conc < -0.00001) return `\\text{Max}(${lx}, ${ly})`;
                  if (type === 'min' && conc > 0.00001) return `\\text{Min}(${lx}, ${ly})`;
              } catch(e) { return null; }
              return null;
          });
      }
      return solutions;
  } catch (e) { return []; }
};

export const solveIntersection = (f1: MathFunction, f2: MathFunction, params: MathParam[], precision: number = 2, bounds?: {min: number, max: number}, targetX?: number, scope: any = {}) => {
    try {
        if (f1.id === f2.id) return [];
        const combinedScope = { ...params.reduce((acc:any,p)=>({...acc,[p.name]:p.value}),{}), ...scope };
        const prepareExpression = (f: MathFunction) => { 
            let expr = sanitizeExpression(f.expression); 
            params.forEach(p => { const regex = new RegExp(`\\b${p.name}\\b`, 'g'); expr = expr.replace(regex, `(${p.value})`); }); 
            return expr; 
        };
        const expr1 = prepareExpression(f1), expr2 = prepareExpression(f2);
        const candidates: {x: number, y: number, latex?: string, exact?: boolean}[] = [];
        const addedHashes = new Set<string>();
        const addCandidate = (x: number, y?: number, latex?: string) => {
            if (!isFinite(x)) return; const hash = x.toFixed(3); if (addedHashes.has(hash)) return; addedHashes.add(hash);
            let yVal = y; if (yVal === undefined) { try { yVal = math.evaluate(expr1, { ...combinedScope, x: x }); } catch {} }
            if (yVal !== undefined && isFinite(yVal)) { candidates.push({ x, y: yVal, latex, exact: !!latex }); }
        };
        if (f1.type === 'function' && f2.type === 'function') {
             const eq = `(${expr1}) - (${expr2})`;
             try {
                const roots = nerdamer.solve(eq, 'x');
                let rootList = Array.isArray(roots) ? roots : roots.toString().replace(/[\[\]]/g, '').split(',');
                rootList.forEach((r: string) => { try { const xVal = parseFloat(nerdamer(r).text('decimals')); if (isFinite(xVal)) { let latex = nerdamer(r).toTeX(); if (!latex.match(/\d{5,}/)) addCandidate(xVal, undefined, latex); else addCandidate(xVal); } } catch {} });
             } catch {}
        }
        let finalCandidates = candidates;
        if (targetX !== undefined) { candidates.sort((a, b) => Math.abs(a.x - targetX) - Math.abs(b.x - targetX)); if (candidates.length > 0 && Math.abs(candidates[0].x - targetX) < 5) finalCandidates = [candidates[0]]; else finalCandidates = []; }
        const results: any[] = [];
        finalCandidates.forEach(cand => {
             let lx = cand.latex || formatNumberToLatex(cand.x, precision);
             const hy = getBestLatex(cand.y, "", precision);
             let ly = hy.includes('\\') || hy.includes('pi') ? hy : `\\approx ${formatNumberDecimal(cand.y, precision)}`;
             results.push({ x: cand.x, y: cand.y, latex: `I(${lx}, ${ly})` });
        });
        return results;
    } catch (e) { return []; }
};

export const asciiToLatex = (expr: string) => { 
    try { 
        if (!expr) return ""; 
        const sanitized = sanitizeExpression(expr);
        let tex = nerdamer(sanitized).toTeX(); 
        tex = tex.replace(/\\mathrm{([^}]+)}/g, '$1').replace(/\\text{([^}]+)}/g, '$1');
        tex = tex.replace(/\*/g, ' \\cdot '); 
        return tex;
    } catch (e) { return expr.replace(/\//g, ' / ').replace(/\*/g, ' \\cdot '); } 
};

export const simpleAsciiToLatex = (expr: string) => {
    if (!expr) return "";
    let tex = expr;
    tex = tex.replace(/\bpi\b/g, '\\pi');
    return tex;
};

export const latexToAscii = (latex: string) => {
  if (!latex) return "";
  let s = latex;
  s = s.replace(/\\placeholder\{[^}]*\}/g, '');
  s = s.replace(/\\mathrm{([^}]+)}/g, '$1').replace(/\\text{([^}]+)}/g, '$1').replace(/\\left/g, '').replace(/\\right/g, '');
  s = s.replace(/\\div/g, '/').replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
  s = s.replace(/\\cdot/g, '*').replace(/\\times/g, '*');
  s = s.replace(/\\le/g, '<=').replace(/\\ge/g, '>=')
       .replace(/\\leq/g, '<=').replace(/\\geq/g, '>=');
  s = s.replace(/\\pi/g, 'pi').replace(/\\sin/g, 'sin').replace(/\\cos/g, 'cos').replace(/\\tan/g, 'tan').replace(/\\ln/g, 'ln').replace(/\\log/g, 'log').replace(/\\arcsin/g, 'asin').replace(/\\arccos/g, 'acos').replace(/\\arctan/g, 'atan');
  s = s.replace(/\^{([^{}]*)}/g, (match, p1) => {
      if (!p1) return "^";
      if (/^[a-zA-Z0-9]+$/.test(p1)) return "^" + p1;
      return `^(${p1})`;
  });
  s = s.replace(/_{([^{}]*)}/g, (match, p1) => {
      if (!p1) return "_";
      if (/^[a-zA-Z0-9]+$/.test(p1)) return "_" + p1;
      return `_(${p1})`;
  });
  s = s.replace(/\\sqrt{([^{}]+)}/g, 'sqrt($1)');
  return s.replace(/\s+/g, '').replace(/\*\*+/g, '*');
};

export const getNextPointLabel = (existingLabels: string[]) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let i = 0;
  while (true) {
    const char = alphabet[i % 26];
    const suffix = Math.floor(i / 26) === 0 ? "" : Math.floor(i / 26);
    const label = `${char}${suffix}`;
    if (!existingLabels.includes(label)) return label;
    i++;
  }
};

export const getNextLineLabel = (existingLabels: string[]) => {
  const alphabet = "rstuvwz"; 
  let i = 0;
  while (true) {
    const char = alphabet[i % alphabet.length];
    const suffix = Math.floor(i / alphabet.length) === 0 ? "" : Math.floor(i / alphabet.length);
    const label = `${char}${suffix}`;
    if (!existingLabels.includes(label)) return label;
    i++;
  }
};

export const preprocessInput = (input: string) => {
    if (!input) return "";
    let clean = input.replace(/\bsen\b/g, 'sin').replace(/\braiz\b/g, 'sqrt').replace(/log_/g, 'log');
    clean = clean.replace(/(\d)\s*,\s*(\d)/g, '$1.$2'); 
    return clean;
};

export const getLineEquationString = (p1: {x: number, y: number}, p2: {x: number, y: number}, precision: number = 2) => {
  if (Math.abs(p2.x - p1.x) < 1e-9) return `x = ${formatNumberDecimal(p1.x, precision)}`;
  const m = (p2.y - p1.y) / (p2.x - p1.x);
  const b = p1.y - m * p1.x;
  let mStr = Math.abs(m) < 1e-9 ? "" : (Math.abs(m - 1) < 1e-9 ? "x" : (Math.abs(m + 1) < 1e-9 ? "-x" : `${formatNumberDecimal(m, precision)}x`));
  let bStr = Math.abs(b) > 1e-9 ? (b > 0 ? (mStr ? ` + ${formatNumberDecimal(b, precision)}` : `${formatNumberDecimal(b, precision)}`) : ` - ${formatNumberDecimal(Math.abs(b), precision)}`) : (!mStr ? "0" : "");
  return `y = ${mStr}${bStr}`;
};

export const parseLineEquation = (eq: string): { m: number, b: number, isVertical: boolean, xVal?: number } | null => {
  const clean = eq.replace(/\s+/g, '').toLowerCase();
  if (clean.startsWith('x=')) {
    const val = parseFloat(clean.split('=')[1]);
    if (!isNaN(val)) return { m: Infinity, b: NaN, isVertical: true, xVal: val };
  }
  if (clean.startsWith('y=')) {
    const rhs = clean.split('=')[1];
    try {
       const node = math.parse(rhs);
       const f = (x: number) => node.evaluate({x});
       const y0 = f(0), y1 = f(1);
       return { m: y1 - y0, b: y0, isVertical: false };
    } catch(e) { return null; }
  }
  return null;
};

export const projectPointOntoLine = (x: number, y: number, lineDef: { m: number, b: number, isVertical: boolean, xVal?: number }) => {
  if (lineDef.isVertical && lineDef.xVal !== undefined) return { x: lineDef.xVal, y: y };
  const { m, b } = lineDef;
  const A = m, B = -1, C = b;
  const denom = A*A + B*B;
  const xp = (B * (B*x - A*y) - A*C) / denom, yp = (A * (-B*x + A*y) - B*C) / denom;
  return { x: xp, y: yp };
};

export const calculateObjectSlope = (obj: AnalysisObject, functions: MathFunction[], analyses: AnalysisObject[], params: MathParam[], calculatedPoints: CalculatedPoint[], visitedIds: Set<string> = new Set()): number | undefined => {
  if (!obj || visitedIds.has(String(obj.id))) return undefined;
  if (obj.type === 'slope_analysis' && obj.targetId) {
    const target = analyses.find(a => String(a.id) === String(obj.targetId));
    if (target) return calculateObjectSlope(target, functions, analyses, params, calculatedPoints, visitedIds);
  }
  if (['line', 'segment', 'ray'].includes(obj.type) && obj.vertices && obj.vertices.length === 2) {
    const p1 = calculatedPoints.find(p => String(p.id) === String(obj.vertices![0]));
    const p2 = calculatedPoints.find(p => String(p.id) === String(obj.vertices![1]));
    if (p1 && p2) {
      if (Math.abs(p2.x - p1.x) < 1e-9) return Infinity;
      return (p2.y - p1.y) / (p2.x - p1.x);
    }
  }
  if (obj.type === 'tangent_analysis' && obj.funcId) {
    const f = functions.find(fn => fn.id === obj.funcId);
    let x = obj.x;
    if (obj.vertices && obj.vertices.length > 0) {
      const p = calculatedPoints.find(pt => String(pt.id) === String(obj.vertices![0]));
      if (p) x = p.x;
    }
    if (f && x !== undefined) {
      const newVisited = new Set(visitedIds);
      newVisited.add(String(obj.id));
      const scope = createMathScope(params, calculatedPoints, analyses, functions, newVisited);
      const h = 1e-5;
      try {
        const y1 = math.evaluate(f.expression, { ...scope, x: x - h });
        const y2 = math.evaluate(f.expression, { ...scope, x: x + h });
        return (y2 - y1) / (2 * h);
      } catch(e) {}
    }
  }
  return undefined;
};

export const createMathScope = (params: MathParam[], calculatedPoints: CalculatedPoint[], activeAnalyses: AnalysisObject[], functions: MathFunction[], visitedIds: Set<string> = new Set()) => {
  const scope: any = {};
  params.forEach(p => scope[p.name] = p.value);
  calculatedPoints.forEach(pt => { if (pt.label) { scope[`x_${pt.label}`] = pt.x; scope[`y_${pt.label}`] = pt.y; } });
  activeAnalyses.forEach(an => {
    const aid = String(an.id);
    if (an.label && !visitedIds.has(aid)) {
      if (['line', 'segment', 'ray', 'tangent_analysis', 'slope_analysis'].includes(an.type)) {
        const slope = calculateObjectSlope(an, functions, activeAnalyses, params, calculatedPoints, visitedIds);
        if (slope !== undefined && isFinite(slope)) {
          scope[an.label] = slope;
          scope[`declive_${an.label}`] = slope;
          scope[`slope_${an.label}`] = slope;
          scope[`m_${an.label}`] = slope;
        }
      }
    }
  });
  return scope;
};

export const getObjectsToRemove = (targetId: string, analyses: AnalysisObject[]): string[] => {
  const toRemove = new Set<string>([targetId]);
  let changed = true;
  while (changed) {
    changed = false;
    analyses.forEach(obj => {
      const oid = String(obj.id);
      if (toRemove.has(oid)) return;
      const hasVertexToRemove = obj.vertices?.some(vid => toRemove.has(String(vid)));
      const hasTargetToRemove = obj.targetId && toRemove.has(String(obj.targetId));
      if (hasVertexToRemove || hasTargetToRemove) { toRemove.add(oid); changed = true; }
    });
  }
  return Array.from(toRemove);
};

export const calculateWorldPoints = (functions: MathFunction[], params: MathParam[], activeAnalyses: AnalysisObject[], precision: number, bounds: { min: number, max: number }): CalculatedPoint[] => {
  let points: CalculatedPoint[] = [];
  activeAnalyses.forEach((an, idx) => {
    if (an.type === 'freePoint' && !an.xExpr && !an.yExpr) {
      points.push({ id: String(an.id), x: an.x || 0, y: an.y || 0, label: an.label, latex: an.label ? `${an.label}(${formatNumberDecimal(an.x || 0, precision)}, ${formatNumberDecimal(an.y || 0, precision)})` : undefined, color: an.color, isFree: true, analysisIndex: idx, size: an.size, pointStyle: an.pointStyle, trace: an.trace });
    }
  });
  for (let i = 0; i < 5; i++) {
    const startCount = points.length;
    activeAnalyses.forEach((an, idx) => {
        const idStr = String(an.id);
        if (points.some(p => p.id === idStr)) return;
        const scope = createMathScope(params, points, activeAnalyses, functions);
        if (an.xExpr || an.yExpr) {
            try {
                const x = an.xExpr ? math.evaluate(sanitizeExpression(an.xExpr), scope) : (an.x || 0);
                const y = an.yExpr ? math.evaluate(sanitizeExpression(an.yExpr), scope) : (an.y || 0);
                if (typeof x === 'number' && typeof y === 'number' && isFinite(x) && isFinite(y)) {
                    const lx = formatNumberDecimal(x, precision), ly = formatNumberDecimal(y, precision);
                    points.push({ id: idStr, x, y, label: an.label, latex: an.label ? `${an.label}(${lx}, ${ly})` : undefined, color: an.color, analysisIndex: idx, size: an.size, pointStyle: an.pointStyle, trace: an.trace });
                }
            } catch(e) {}
        }
        else if (an.type === 'pointOn_analysis' && an.funcId) {
            const f = functions.find(fn => fn.id === an.funcId);
            if (f && an.x !== undefined) {
                try {
                    let targetX = an.x;
                    let rMin = -Infinity, rMax = Infinity;
                    if (f.rangeMin) {
                        const val = math.evaluate(sanitizeExpression(f.rangeMin), scope);
                        if (typeof val === 'number' && !isNaN(val)) rMin = val;
                    }
                    if (f.rangeMax) {
                        const val = math.evaluate(sanitizeExpression(f.rangeMax), scope);
                        if (typeof val === 'number' && !isNaN(val)) rMax = val;
                    }
                    
                    if (targetX < rMin || targetX > rMax) return;

                    const y = math.evaluate(sanitizeExpression(f.expression), { ...scope, x: targetX });
                    if (typeof y === 'number' && isFinite(y) && !isNaN(y)) {
                        const lx = formatNumberDecimal(targetX, precision), ly = formatNumberDecimal(y, precision);
                        points.push({ id: idStr, x: targetX, y, label: an.label, latex: an.label ? `${an.label}(${lx}, ${ly})` : undefined, color: an.color, analysisIndex: idx, size: an.size, pointStyle: an.pointStyle, trace: an.trace });
                    }
                } catch {}
            }
        }
        else if (an.type === 'intersection_analysis' && an.funcId && an.funcId2) {
            const f1 = functions.find(f => f.id === an.funcId), f2 = functions.find(f => f.id === an.funcId2);
            if (f1 && f2) {
                const results = solveIntersection(f1, f2, params, precision, bounds, an.x, scope);
                if (results.length > 0) {
                    const pt = results[0];
                    points.push({ id: idStr, x: pt.x, y: pt.y, label: an.label, latex: pt.latex, color: an.color, analysisIndex: idx, size: an.size || 5, pointStyle: an.pointStyle, trace: an.trace });
                }
            }
        }
        else if (an.type === 'func_analysis' && an.funcId && an.subtype) {
            const f = functions.find(fn => fn.id === an.funcId);
            if (f) {
                if (an.x !== undefined) {
                    const res = solveClosest(f.expression, an.subtype, an.x, params, precision, scope);
                    if (res) points.push({ id: idStr, x: res.x, y: res.y, label: an.label, latex: res.latex, color: an.color, analysisIndex: idx, size: an.size || 5, pointStyle: an.pointStyle, trace: an.trace });
                } else {
                    const resList = solveSymbolic(f.expression, an.subtype, params, precision);
                    resList.forEach((res, i) => {
                        points.push({ id: `${an.id}-${i}`, x: res.x, y: res.y, label: an.label ? `${an.label}_${i+1}` : undefined, latex: res.latex, color: an.color, analysisIndex: idx, size: an.size || 5, pointStyle: an.pointStyle, trace: an.trace });
                    });
                }
            }
        }
    });
    if (points.length === startCount) break;
  }
  return points;
};
