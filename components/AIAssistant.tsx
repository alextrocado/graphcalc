import React, { useState, useRef, useEffect } from 'react';
import { MathFunction, MathParam, ViewPort, AnalysisObject } from '../types';
import * as Icons from './Icons';
// Fixed: Removed incorrect import of generateMathResponse from mathUtils.ts as it's provided by geminiService.ts
import { generateMathResponse as generateGeminiResponse } from '../services/geminiService';

interface AIAssistantProps {
  isOpen: boolean;
  width: number;
  setWidth: (width: number) => void;
  functions: MathFunction[];
  params: MathParam[];
  view: ViewPort;
  activeAnalyses: AnalysisObject[];
  onGeneralInput: (val: string) => void;
  onUpdateParam: (name: string, val: number) => void;
  onRemoveFunction: (id: number) => void;
  onRemoveParam: (name: string) => void;
  fontSize: number;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  type?: 'error' | 'success';
}

const AIAssistant: React.FC<AIAssistantProps> = ({ 
  isOpen, width, setWidth, functions, params, view, activeAnalyses, onGeneralInput, onUpdateParam, onRemoveFunction, onRemoveParam, fontSize
}) => {
  const [prompt, setPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isResizing = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = Math.max(200, Math.min(600, window.innerWidth - e.clientX));
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'default';
  };

  const handleGeminiSubmit = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (!prompt.trim()) return; 
      const userMsg: ChatMessage = { role: 'user', text: prompt }; 
      setChatHistory(prev => [...prev, userMsg]); 
      setPrompt(""); 
      setLoading(true); 
      try { 
          const response = await generateGeminiResponse(userMsg.text, functions, params, view, activeAnalyses); 
          setChatHistory(prev => [...prev, { role: 'model', text: response.text, type: 'success' }]); 
          if (response.commands && response.commands.length > 0) { 
              response.commands.forEach(cmd => { 
                  if (cmd.action === 'add_function') onGeneralInput(cmd.argument); 
                  else if (cmd.action === 'set_param' && cmd.value !== undefined) onUpdateParam(cmd.argument, cmd.value); 
                  else if (cmd.action === 'remove_function') { 
                      const func = functions.find(f => f.name === cmd.argument); 
                      if (func) onRemoveFunction(func.id); 
                  }
                  else if (cmd.action === 'remove_param') onRemoveParam(cmd.argument);
              }); 
          } 
      } catch (error) { setChatHistory(prev => [...prev, { role: 'model', text: "Error connecting to AI.", type: 'error' }]); } 
      finally { setLoading(false); } 
  };

  const renderWithLatex = (text: string) => { 
      const katex = (window as any).katex;
      if (!text) return null;

      const regex = /(\$[^$]+\$|\\\(.*?\\\)|\\\[.*?\\\])/g;
      const parts = text.split(regex); 

      return parts.map((part, index) => { 
          if (
              (part.startsWith('$') && part.endsWith('$')) || 
              (part.startsWith('\\(') && part.endsWith('\\)')) ||
              (part.startsWith('\\[') && part.endsWith('\\]'))
          ) { 
              let latex = part;
              if (part.startsWith('$')) latex = part.slice(1, -1);
              else if (part.startsWith('\\(')) latex = part.slice(2, -2);
              else if (part.startsWith('\\[')) latex = part.slice(2, -2);
              
              try { 
                  if (!katex) return <span key={index}>{part}</span>;
                  const html = katex.renderToString(latex, { throwOnError: false, displayMode: part.includes('\\[') }); 
                  return <span key={index} className="inline-block px-0.5" dangerouslySetInnerHTML={{ __html: html }} />; 
              } catch { return <span key={index}>{part}</span>; } 
          } 
          return <span key={index} className="whitespace-pre-wrap">{part}</span>; 
      }); 
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, loading]);

  const dynamicTextStyle = {
    fontSize: `${Math.max(12, fontSize - 2)}px`,
    lineHeight: '1.5'
  };

  return (
    <div 
      className={`${isOpen ? 'border-l border-[#E5E7EB]' : 'w-0'} bg-white flex flex-col transition-all duration-300 overflow-hidden relative shadow-lg z-10 h-full`}
      style={{ width: isOpen ? `${width}px` : '0px' }}
    >
      {isOpen && (
        <div 
          className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-[#007888]/30 active:bg-[#007888]/50 z-20 transition-colors"
          onMouseDown={handleMouseDown}
        />
      )}

      <div className="p-3 bg-[#E0F2F1] border-b border-[#B2DFDB] flex justify-between items-center text-[#00695C] font-bold text-sm">
        <div className="flex items-center gap-2">
          <Icons.IconSparkles />
          <span>AI Assistant</span>
        </div>
        {chatHistory.length > 0 && <button onClick={() => setChatHistory([])} className="text-xs text-[#004D40] hover:text-[#007888] underline">Clear</button>}
      </div> 
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/50">
        {chatHistory.length === 0 && (
          <div className="text-center text-[#5c8585] mt-10 px-4 italic leading-relaxed" style={{ fontSize: `${fontSize - 4}px` }}>
            Hello! I am your math assistant. I can help you create functions, explain concepts, or adjust parameters.
            Try: "Plot the derivative of sin(x)" or "Set a=5".
          </div>
        )}
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[90%] rounded-lg p-3 shadow-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#007888] text-white rounded-br-none' : `${msg.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-white text-gray-800 border border-[#B2DFDB]'} rounded-bl-none`}`}
              style={dynamicTextStyle}
            >
              {msg.role === 'model' ? <div>{renderWithLatex(msg.text)}</div> : msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#B2DFDB] rounded-lg rounded-bl-none p-2 shadow-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-[#4DB6AC] rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                <div className="w-1.5 h-1.5 bg-[#4DB6AC] rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                <div className="w-1.5 h-1.5 bg-[#4DB6AC] rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div> 
      <div className="p-3 bg-white border-t border-[#B2DFDB]">
        <form onSubmit={handleGeminiSubmit} className="relative">
          <input 
            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#007888] bg-gray-50 placeholder-gray-400" 
            placeholder="Type a message..." 
            value={prompt} 
            onChange={e => setPrompt(e.target.value)} 
            disabled={loading}
            style={{ fontSize: `${Math.max(12, fontSize - 2)}px` }}
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-[#007888] hover:text-[#004D40] disabled:opacity-50 p-1.5" disabled={loading}>
            <Icons.IconSend />
          </button>
        </form>
      </div> 
    </div>
  );
};

export default AIAssistant;