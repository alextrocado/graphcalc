
export const COLORS = [
  '#007888', // Camões Teal (Cor Principal)
  '#D32F2F', // Vermelho Forte (Contraste)
  '#1976D2', // Azul Institucional
  '#F57C00', // Laranja
  '#7B1FA2', // Roxo
  '#388E3C', // Verde
  '#455A64', // Cinza Azulado
  '#000000'  // Preto
];

export const FUNCTION_NAMES = ['f', 'g', 'h', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'z'];

export const INITIAL_VIEW = { x: 0, y: 0, scaleX: 50, scaleY: 50 };
export const INITIAL_FUNCTIONS = [
  { 
    id: 1, 
    name: 'f', 
    expression: 'sin(x)', 
    inputValue: 'sin(x)', 
    type: 'function' as const, 
    color: COLORS[0], // Começa com a cor da marca
    visible: true 
  }
];
export const INITIAL_PARAMS = [
  { name: 'a', value: 1, min: -5, max: 5, step: 0.1 }
];
