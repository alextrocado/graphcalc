import React, { useState, useEffect } from 'react';
import * as Icons from './Icons';

interface VirtualKeyboardProps {
  onClose: () => void;
  isOpen: boolean;
}

const Key = ({ label, value, action, offset = 0, className = "", onInput }: any) => {
  const preventBlur = (e: React.SyntheticEvent) => {
    e.preventDefault();
  };

  const handleClick = (e: React.MouseEvent) => {
     e.preventDefault();
     onInput(value || label, action || 'insert', offset);
  };

  return (
    <button
      onMouseDown={preventBlur}
      onTouchStart={preventBlur}
      onClick={handleClick}
      className={`flex-1 rounded-md shadow-sm border-b-2 border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-200 active:border-b-0 active:translate-y-[2px] font-medium text-lg flex items-center justify-center py-2 select-none transition-all ${className}`}
      type="button"
    >
      {label}
    </button>
  );
};

const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ onClose, isOpen }) => {
  const [activeTab, setActiveTab] = useState<'123' | 'f(x)' | 'ABC'>('123');
  const [shift, setShift] = useState(false);

  useEffect(() => {
    if (isOpen && window.innerWidth < 768) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInput = (value: string, action: 'insert' | 'command' | 'backspace' | 'enter' | 'left' | 'right' = 'insert', cursorOffset = 0) => {
      const activeEl = document.activeElement as HTMLElement;
      if (!activeEl) return;
      
      if (activeEl.tagName === 'MATH-FIELD') {
          const mf = activeEl as any;
          if (action === 'insert') {
              if (value === '()/()') mf.executeCommand(['insert', '/']); 
              else mf.executeCommand(['insert', value]);
          }
          else if (action === 'command') mf.executeCommand(['insert', value]);
          else if (action === 'backspace') mf.executeCommand('deleteBackward');
          else if (action === 'left') mf.executeCommand('moveToPreviousChar');
          else if (action === 'right') mf.executeCommand('moveToNextChar');
          else if (action === 'enter') {
               const event = new KeyboardEvent('keydown', {
                   key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true, cancelable: true
               });
               activeEl.dispatchEvent(event);
          }
          return;
      }

      if (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA') return;
      
      const inputEl = activeEl as HTMLInputElement;
      const start = inputEl.selectionStart || 0;
      const end = inputEl.selectionEnd || 0;
      const val = inputEl.value;

      let newValue = val;
      let newCursorPos = start;

      if (action === 'insert' || action === 'command') {
          newValue = val.slice(0, start) + value + val.slice(end);
          newCursorPos = start + value.length + cursorOffset;
      } 
      else if (action === 'backspace') {
          if (start === end && start > 0) {
              newValue = val.slice(0, start - 1) + val.slice(end);
              newCursorPos = start - 1;
          } else if (start !== end) {
              newValue = val.slice(0, start) + val.slice(end);
              newCursorPos = start;
          }
      } 
      else if (action === 'left') {
          newCursorPos = Math.max(0, start - 1);
          inputEl.setSelectionRange(newCursorPos, newCursorPos);
          return;
      } 
      else if (action === 'right') {
          newCursorPos = Math.min(val.length, start + 1);
          inputEl.setSelectionRange(newCursorPos, newCursorPos);
          return;
      } 
      else if (action === 'enter') {
           const event = new KeyboardEvent('keydown', {
               key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true, cancelable: true
           });
           inputEl.dispatchEvent(event);
           return;
      }

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (nativeInputValueSetter) nativeInputValueSetter.call(inputEl, newValue);
      else inputEl.value = newValue;

      const inputEvent = new Event('input', { bubbles: true });
      inputEl.dispatchEvent(inputEvent);
      inputEl.setSelectionRange(newCursorPos, newCursorPos);
  };

  const preventContainerBlur = (e: React.SyntheticEvent) => {
      e.preventDefault();
  };

  return (
      <div 
        className="fixed z-[100] flex flex-col bg-gray-100 border-t border-gray-300 shadow-2xl transition-all duration-300 
                   w-full bottom-0 left-0
                   md:w-[600px] md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:rounded-xl md:border md:border-gray-300"
        style={{ height: '300px', maxHeight: '50vh' }}
        onMouseDown={preventContainerBlur}
        onTouchStart={preventContainerBlur}
      >
          <div className="flex bg-[#eef2f5] p-2 gap-2 border-b border-gray-300 md:rounded-t-xl">
              {['123', 'f(x)', 'ABC'].map(t => (
                  <button 
                    key={t}
                    onMouseDown={preventContainerBlur}
                    onTouchStart={preventContainerBlur}
                    onClick={() => setActiveTab(t as any)} 
                    type="button"
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${activeTab === t ? 'bg-[#007888] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                  >
                      {t}
                  </button>
              ))}
              <div className="flex-1"></div>
              <button onMouseDown={preventContainerBlur} onTouchStart={preventContainerBlur} onClick={onClose} type="button" className="px-3 py-1 rounded-full hover:bg-gray-300 text-gray-500 font-bold">✕</button>
          </div>

          <div className="flex-1 p-2 bg-[#f0f0f5] overflow-y-auto md:rounded-b-xl">
              {activeTab === '123' && (
                  <div className="flex gap-2 h-full">
                      <div className="flex-[4] grid grid-cols-4 gap-1.5 h-full content-start">
                          <Key label="x" value="x" className="font-serif italic text-gray-800" onInput={handleInput} />
                          <Key label="y" value="y" className="font-serif italic text-gray-800" onInput={handleInput} />
                          <Key label="z" value="z" className="font-serif italic text-gray-800" onInput={handleInput} />
                          <Key label="π" value="pi" className="text-gray-800" onInput={handleInput} />

                          <Key label={<Icons.IconSquare />} value="^2" className="text-gray-700" onInput={handleInput} />
                          <Key label={<Icons.IconPower />} value="^" className="text-gray-700" onInput={handleInput} />
                          <Key label={<Icons.IconSqrt />} value="sqrt" className="text-gray-700" onInput={handleInput} />
                          <Key label="e" value="e" className="font-serif italic text-gray-800" onInput={handleInput} />

                          <Key label="<" value="<" className="text-gray-700" onInput={handleInput} />
                          <Key label=">" value=">" className="text-gray-700" onInput={handleInput} />
                          <Key label="|a|" value="abs" className="text-sm text-gray-700" onInput={handleInput} />
                          <Key label="," value="," className="text-gray-800" onInput={handleInput} />

                          <Key label="(" value="(" className="text-gray-700" onInput={handleInput} />
                          <Key label=")" value=")" className="text-gray-700" onInput={handleInput} />
                          <Key label="%" value="%" className="text-gray-700" onInput={handleInput} /> 
                          <Key label="÷" value="/" className="text-lg bg-gray-50" onInput={handleInput} /> 
                      </div>

                      <div className="flex-[3] grid grid-cols-3 gap-1.5 h-full content-start">
                          <Key label="7" className="bg-white font-semibold text-gray-700" onInput={handleInput} />
                          <Key label="8" className="bg-white font-semibold text-gray-700" onInput={handleInput} />
                          <Key label="9" className="bg-white font-semibold text-gray-700" onInput={handleInput} />
                          <Key label="4" className="bg-white font-semibold text-gray-700" onInput={handleInput} />
                          <Key label="5" className="bg-white font-semibold text-gray-700" onInput={handleInput} />
                          <Key label="6" className="bg-white font-semibold text-gray-700" onInput={handleInput} />
                          <Key label="1" className="bg-white font-semibold text-gray-700" onInput={handleInput} />
                          <Key label="2" className="bg-white font-semibold text-gray-700" onInput={handleInput} />
                          <Key label="3" className="bg-white font-semibold text-gray-700" onInput={handleInput} />
                          <Key label="0" className="bg-white font-semibold text-gray-700" onInput={handleInput} />
                          <Key label="." className="bg-white font-bold text-gray-700" onInput={handleInput} />
                          <Key label={<Icons.IconBackspace />} action="backspace" className="bg-[#d1d5db] text-gray-800 border-gray-400" onInput={handleInput} />
                      </div>

                      <div className="flex-[1] flex flex-col gap-1.5">
                          <Key label="÷" value="/" className="bg-[#e5e7eb] text-gray-900 font-bold" onInput={handleInput} />
                          <Key label="×" value="*" className="bg-[#e5e7eb] text-gray-900 font-bold" onInput={handleInput} />
                          <Key label="−" value="-" className="bg-[#e5e7eb] text-gray-900 font-bold" onInput={handleInput} />
                          <Key label="+" value="+" className="bg-[#e5e7eb] text-gray-900 font-bold" onInput={handleInput} />
                          <Key label="=" value="=" action="enter" className="flex-[1.5] bg-[#007888] text-white border-[#006064] hover:bg-[#006064]" onInput={handleInput} />
                      </div>
                  </div>
              )}

              {activeTab === 'f(x)' && (
                  <div className="grid grid-cols-4 gap-2 h-full content-start">
                      <div className="col-span-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Trigonometria</div>
                      <Key label="sin" value="sin" action="command" className="text-sm bg-white" onInput={handleInput} />
                      <Key label="cos" value="cos" action="command" className="text-sm bg-white" onInput={handleInput} />
                      <Key label="tan" value="tan" action="command" className="text-sm bg-white" onInput={handleInput} />
                      <Key label="asin" value="asin" action="command" className="text-sm bg-white" onInput={handleInput} />
                      <Key label="sec" value="sec" action="command" className="text-sm bg-white" onInput={handleInput} />
                      <Key label="csc" value="csc" action="command" className="text-sm bg-white" onInput={handleInput} />
                      <Key label="cot" value="cot" action="command" className="text-sm bg-white" onInput={handleInput} />
                      <Key label="acos" value="acos" action="command" className="text-sm bg-white" onInput={handleInput} />
                      <div className="col-span-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 mt-2">Álgebra & Logaritmos</div>
                      <Key label="ln" value="ln" action="command" className="text-sm bg-white" onInput={handleInput} />
                      <Key label="log₁₀" value="log" action="command" className="text-sm bg-white" onInput={handleInput} />
                      <Key label="logₙ" value="log" action="command" className="text-sm bg-white" onInput={handleInput} />
                      <Key label="atan" value="atan" action="command" className="text-sm bg-white" onInput={handleInput} />
                      <Key label="derivada" value="derivada" className="text-sm bg-white col-span-2" onInput={handleInput} />
                      <Key label="integral" value="integral" className="text-sm bg-white col-span-2" onInput={handleInput} />
                  </div>
              )}

              {activeTab === 'ABC' && (
                  <div className="flex flex-col gap-1.5 h-full">
                       <div className="grid grid-cols-10 gap-1">
                           {"qwertyuiop".split("").map(k => <Key key={k} label={shift ? k.toUpperCase() : k} value={shift ? k.toUpperCase() : k} className="text-lg py-2 bg-white" onInput={handleInput} />)}
                       </div>
                       <div className="grid grid-cols-9 gap-1 px-4">
                           {"asdfghjkl".split("").map(k => <Key key={k} label={shift ? k.toUpperCase() : k} value={shift ? k.toUpperCase() : k} className="text-lg py-2 bg-white" onInput={handleInput} />)}
                       </div>
                       <div className="grid grid-cols-9 gap-1 px-2">
                           <button onMouseDown={preventContainerBlur} onTouchStart={preventContainerBlur} onClick={() => setShift(!shift)} type="button" className={`rounded p-2 text-xs font-bold ${shift ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'}`}>⇧</button>
                           {"zxcvbnm".split("").map(k => <Key key={k} label={shift ? k.toUpperCase() : k} value={shift ? k.toUpperCase() : k} className="text-lg py-2 bg-white" onInput={handleInput} />)}
                           <Key label={<Icons.IconBackspace />} action="backspace" className="bg-[#d1d5db]" onInput={handleInput} />
                       </div>
                       <div className="grid grid-cols-5 gap-1 px-12 mt-1">
                           <Key label="Espaço" value=" " className="col-span-3 text-xs bg-white" onInput={handleInput} />
                           <Key label="Enter" action="enter" className="col-span-2 bg-[#007888] text-white border-none" onInput={handleInput} />
                       </div>
                  </div>
              )}
          </div>
      </div>
  );
};

export default VirtualKeyboard;