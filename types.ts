

export type ToolType = 
| 'move' 
| 'freePoint' 
| 'polygon' 
| 'eraser' 
| 'line' 
| 'ray' 
| 'segment'
| 'tangent' 
| 'zeros' 
| 'max' 
| 'min' 
| 'intersect' 
| 'intersectObjects'
| 'pointOn';

export interface ViewPort {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

export interface MathFunction {
  id: number;
  name: string;
  expression: string;
  inputValue: string;
  type: 'function' | 'inequality' | 'vertical' | 'empty' | 'implicit';
  color: string;
  visible: boolean;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  lineWidth?: number;
  rangeMin?: string;
  rangeMax?: string;
  error?: boolean;
  trace?: boolean;
  derivedFrom?: number; // ID of the parent function
  derivationType?: 'derivative' | 'integral'; // Type of relationship
}

export interface MathParam {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  top?: number;
  left?: number;
}

export interface AnalysisObject {
  id: number | string;
  type: 'freePoint' | 'polygon' | 'tangent_analysis' | 'intersection_analysis' | 'func_analysis' | 'pointOn_analysis' | 'line' | 'ray' | 'segment' | 'slope_analysis';
  subtype?: 'zeros' | 'min' | 'max';
  label?: string; // Point Label (A, B, C...)
  x?: number;
  y?: number;
  xExpr?: string; // Dynamic expression for X (e.g. "x_A + 1")
  yExpr?: string; // Dynamic expression for Y
  vertices?: string[]; // IDs of points
  targetId?: string; // ID of the object being analyzed (e.g., for slope)
  funcId?: number;
  funcId2?: number; // For intersection
  color?: string;
  size?: number;
  latex?: string;
  visible?: boolean; // Visibility state
  // Visual props for lines
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  lineWidth?: number;
  pointStyle?: 'solid' | 'open' | 'cross';
  trace?: boolean;
}

export interface CalculatedPoint {
  id: string;
  x: number;
  y: number;
  label?: string; // Added for scope referencing
  latex?: string;
  color?: string;
  isFree?: boolean;
  isTangent?: boolean;
  isLabelAnchor?: boolean;
  m?: number;
  b?: number;
  analysisIndex: number;
  size?: number;
  pointStyle?: 'solid' | 'open' | 'cross';
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  lineWidth?: number;
  trace?: boolean;
}

declare global {
  const nerdamer: any;
  const katex: any;
  const math: any;
}