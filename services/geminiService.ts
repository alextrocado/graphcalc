import { GoogleGenAI, Type, SchemaType } from "@google/genai";
import { MathFunction, MathParam, ViewPort, AnalysisObject } from "../types";

interface AICommand {
  action: 'add_function' | 'set_param' | 'remove_function' | 'remove_param';
  argument: string;
  value?: number;
}

interface AIResponse {
  text: string;
  commands: AICommand[];
}

export const generateMathResponse = async (
  prompt: string, 
  functions: MathFunction[], 
  params: MathParam[],
  view: ViewPort,
  activeAnalyses: AnalysisObject[]
): Promise<AIResponse> => {
  
  // 1. Chave de API (Garante que corrigiste o espaço no Vercel!)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  
  if (!apiKey) {
    console.error("API Key em falta.");
    return { text: "Erro: Chave de API não configurada no Vercel.", commands: [] };
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  // --- Lógica de Construção do Contexto (Mantida igual) ---
  const findObj = (id: string | number) => activeAnalyses.find(a => String(a.id) === String(id));

  const constructions = activeAnalyses.map(a => {
      const base = { id: a.id, type: a.type, label: a.label || "Unnamed", color: a.color };

      if (a.type === 'freePoint') return { ...base, description: `Free Point at (${a.x?.toFixed(2)}, ${a.y?.toFixed(2)})` };
      
      if (a.type === 'pointOn_analysis') {
          const func = functions.find(f => f.id === a.funcId);
          return { ...base, description: `Point constrained to function ${func ? func.name : 'unknown'}`, x_value: a.x };
      }

      if (a.type === 'tangent_analysis') {
          const func = functions.find(f => f.id === a.funcId);
          let x = a.x;
          let dependency = "";
          if (a.vertices && a.vertices.length > 0) {
              const pointObj = findObj(a.vertices[0]);
              if (pointObj && pointObj.x !== undefined) {
                  x = pointObj.x;
                  dependency = ` passing through point ${pointObj.label || 'unknown'}`;
              }
          }
          return { ...base, type: "Tangent Line", description: `Tangent line '${a.label}' to function ${func ? func.name : 'unknown'} at x=${x?.toFixed(4)}${dependency}` };
      }

      if (a.type === 'line' || a.type === 'segment' || a.type === 'ray') {
           return { ...base, description: `${a.type} connecting defined points`, vertexIds: a.vertices }
      }

      if (a.type === 'func_analysis') return { ...base, description: `Calculated point (${a.subtype}) on function` };
      if (a.type === 'intersection_analysis') return { ...base, description: `Intersection point` };

      return base;
  });

  const context = {
    expressions: functions.map(f => ({ 
        name: f.name, 
        expr: f.expression, 
        type: f.type,
        visible: f.visible,
        domain: f.rangeMin && f.rangeMax ? [f.rangeMin, f.rangeMax] : "All Real Numbers"
    })),
    parameters: params.map(p => ({ name: p.name, value: p.value })),
    viewWindow: { centerX: view.x, centerY: view.y, zoom: view.scaleX },
    constructions: constructions
  };
  // -----------------------------------------------------

  const systemInstruction = `
    You are an intelligent math assistant integrated into "Graph Calc".
    OUTPUT JSON ONLY.
    
    Current App state:
    ${JSON.stringify(context)}

    You can execute commands in the "commands" array:
    - add_function (argument: expression)
    - set_param (argument: name, value: number)
    - remove_function (argument: name)
    - remove_param (argument: name)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      // CORREÇÃO 1: Formato correto do contents (Array)
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            text: { type: SchemaType.STRING, description: "Message to the user." },
            commands: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  action: { type: SchemaType.STRING, enum: ["add_function", "set_param", "remove_function", "remove_param"] },
                  argument: { type: SchemaType.STRING },
                  value: { type: SchemaType.NUMBER, nullable: true }
                },
                required: ["action", "argument"]
              }
            }
          },
          required: ["text", "commands"]
        }
      }
    });

    if (!response) throw new Error("No response from AI");

    // CORREÇÃO 2: .text() é uma função neste SDK
    const resultText = typeof response.text === 'function' ? response.text() : response.text;

    if (!resultText) throw new Error("Empty text response");

    try {
        const parsed = JSON.parse(resultText) as AIResponse;
        return parsed;
    } catch (e) {
        console.error("Parse Error", e);
        return { text: "Error interpreting AI response.", commands: [] };
    }

  } catch (error: any) {
    console.error("Gemini Error:", error);
    return { 
        text: `Error: ${error.message}`, 
        commands: [] 
    };
  }
};