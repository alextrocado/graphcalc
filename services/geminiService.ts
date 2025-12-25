import { GoogleGenAI, Type } from "@google/genai";
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
  
  // Always use a named parameter for the API key as per @google/genai guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const findObj = (id: string | number) => activeAnalyses.find(a => String(a.id) === String(id));

  const constructions = activeAnalyses.map(a => {
      const base = {
          id: a.id,
          type: a.type,
          label: a.label || "Unnamed",
          color: a.color
      };

      if (a.type === 'freePoint') {
          return { ...base, description: `Free Point at (${a.x?.toFixed(2)}, ${a.y?.toFixed(2)})` };
      }
      
      if (a.type === 'pointOn_analysis') {
          const func = functions.find(f => f.id === a.funcId);
          return { 
              ...base, 
              description: `Point constrained to function ${func ? func.name : 'unknown'}`,
              x_value: a.x 
          };
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

          return { 
              ...base, 
              type: "Tangent Line",
              description: `Tangent line '${a.label}' to function ${func ? func.name : 'unknown'} at x=${x?.toFixed(4)}${dependency}`
          };
      }

      if (a.type === 'line' || a.type === 'segment' || a.type === 'ray') {
           return {
               ...base,
               description: `${a.type} connecting defined points`,
               vertexIds: a.vertices
           }
      }

      if (a.type === 'func_analysis') {
          return { ...base, description: `Calculated point (${a.subtype}) on function` };
      }
      
      if (a.type === 'intersection_analysis') {
          return { ...base, description: `Intersection point` };
      }

      return base;
  });

  const context = {
    expressions: functions.map(f => ({ 
        name: f.name, 
        expr: f.expression, 
        type: f.type, // 'function', 'vertical', 'implicit', 'inequality'
        visible: f.visible,
        domain: f.rangeMin && f.rangeMax ? [f.rangeMin, f.rangeMax] : "All Real Numbers"
    })),
    parameters: params.map(p => ({ name: p.name, value: p.value })),
    viewWindow: {
        centerX: view.x,
        centerY: view.y,
        zoom: view.scaleX
    },
    constructions: constructions
  };

  const systemInstruction = `
    You are an intelligent math assistant integrated into "Graph Calc", an advanced graphing calculator.
    
    CRITICAL MATH KNOWLEDGE:
    1. A 'vertical' type expression (e.g., x = 2) is NOT a function. It is a vertical line or geometric relation. It fails the vertical line test.
    2. A 'function' type expression (e.g., y = 2 or f(x) = x^2) IS a function.
    3. If the user asks "is h a function?" and h is defined as "x = c" (vertical type), you must categorically answer that it is NOT a function, but a vertical line.
    4. Be specific: Whenever explaining a function that uses parameters (e.g., a, b, c), replace those parameters with their current numerical values in your explanation for clarity.
    5. DERIVATIVES: To represent a derivative, you can use functional notation (e.g., "g(x)=f'(x)") or the command "derivative(f)". The App will automatically detect the symbolic link so the graph is drawn correctly and updates if the original function changes.

    FORMATTING RULES:
    - Always respond in English. Be rigorous but pedagogical.
    - Use LaTeX for mathematical formulas in the 'text' field using $...$ delimiters.
    - IMPORTANT: NEVER place explanatory text (normal sentences) inside $ delimiters. LaTeX should be used ONLY for pure math notation. If you mix text in $, it will look cluttered and lack spaces.
    - Correct Example: "The function $f(x)=x^2$ is a parabola."
    - Wrong Example: "$The function f(x)=x^2 is a parabola.$"

    Current App state:
    ${JSON.stringify(context)}

    You can execute commands:
    1. add_function: 'argument' is the expression (e.g., "y=x^2" or "g(x)=f'(x)").
    2. set_param: 'argument' is the name, 'value' is the number.
    3. remove_function: 'argument' is the name.
    4. remove_param: 'argument' is the name.
  `;

  try {
    // Correctly calling generateContent with the model name 'gemini-3-flash-preview' and prompt.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "Message to the user." },
            commands: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING, enum: ["add_function", "set_param", "remove_function", "remove_param"] },
                  argument: { type: Type.STRING },
                  value: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    // Access the text property directly from GenerateContentResponse as per guidelines.
    let result = response.text;
    if (!result) throw new Error("No response from AI");

    try {
        const parsed = JSON.parse(result) as AIResponse;
        return parsed;
    } catch (e) {
        return { text: "Error interpreting AI response.", commands: [] };
    }

  } catch (error: any) {
    console.error("Gemini Error:", error);
    return { 
        text: `An error occurred: ${error.message}`, 
        commands: [] 
    };
  }
};