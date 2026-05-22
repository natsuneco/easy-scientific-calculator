import { useState, useRef, useEffect } from 'react';
import { MathfieldElement } from 'mathlive';
import { ComputeEngine } from '@cortex-js/compute-engine';
import { useWebHaptics } from 'web-haptics/react';

const ce = new ComputeEngine();

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement>;
    }
  }
}

export default function App() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const [isShift, setIsShift] = useState(false);
  const [ansValue, setAnsValue] = useState('0');
  const mfRef = useRef<MathfieldElement>(null);
  const { trigger } = useWebHaptics();

  // Compute Engineを利用した数式評価
  const evaluateExpression = (expr: string, ans: string): string => {
    if (!expr) return "";
    try {
      // Ansを代入するためにスコープに変数を設定
      ce.assign('Ans', ce.parse(ans));
      // LaTeXの数式をパース
      const parsed = ce.parse(expr);
      // N()で数値評価
      const val = parsed.N().valueOf();
      
      if (typeof val === 'number') {
        if (!isFinite(val) || isNaN(val)) return "Math Error";
        return String(Math.round(val * 1e10) / 1e10);
      }
      return String(val);
    } catch {
      return "Syntax Error";
    }
  };

  useEffect(() => {
    if (mfRef.current) {
      mfRef.current.addEventListener('input', (evt: Event) => {
        setExpression((evt.target as MathfieldElement).value);
      });
      // Degree mode setup for compute engine
      (ce as any).angleMode = 'deg';
      // Disable the default virtual keyboard
      mfRef.current.mathVirtualKeyboardPolicy = "manual";
    }
  }, []);

  const handleKeyPress = (action: string) => {
    trigger('light');
    
    const mf = mfRef.current;
    if (!mf) return;

    if (action === 'ac') {
      mf.value = '';
      setExpression('');
      setResult('');
      setIsShift(false);
      return;
    }
    
    if (action === 'del') {
      mf.executeCommand('deleteBackward');
      return;
    }

    if (action === '=') {
      const res = evaluateExpression(expression, ansValue);
      setResult(res);
      if (res !== "Math Error" && res !== "Syntax Error") {
        setAnsValue(res);
      }
      setIsShift(false);
      return;
    }

    if (action === 'shift') {
      setIsShift(!isShift);
      return;
    }

    if (action === 'frac') {
      mf.executeCommand(['insert', '/']);
      if (isShift) {
        setIsShift(false);
      }
      mf.focus();
      return;
    }

    // Handle power (x^n): insert empty superscript and place cursor inside
    if (action === 'power') {
      mf.executeCommand(['insert', '^{}']);
      // Move caret into the superscript field so next input goes into the exponent
      mf.executeCommand('moveToSuperscript');
      if (isShift) setIsShift(false);
      mf.focus();
      return;
    }

    // Handle engineering exponent (×10^n): insert ×10^{} and place caret inside
    if (action === 'exp') {
      if (isShift) {
        mf.executeCommand(['insert', '\\pi']);
      } else {
        mf.executeCommand(['insert', '\\times 10^{}']);
        mf.executeCommand('moveToSuperscript');
      }
      if (isShift) setIsShift(false);
      mf.focus();
      return;
    }

    // Insert LaTeX or Commands into MathField
    let inputStr: string;
    if (action === 'sin') inputStr = isShift ? '\\arcsin(' : '\\sin(';
    else if (action === 'cos') inputStr = isShift ? '\\arccos(' : '\\cos(';
    else if (action === 'tan') inputStr = isShift ? '\\arctan(' : '\\tan(';
    else if (action === 'log') inputStr = '\\log(';
    else if (action === 'ln') inputStr = '\\ln(';
    else if (action === 'sqrt') inputStr = isShift ? '\\sqrt[3]{' : '\\sqrt{';
    else if (action === 'sqr') inputStr = isShift ? '^3' : '^2';
    else if (action === 'ans') inputStr = 'Ans';
    else if (action === 'power') inputStr = '^';
    else if (action === '.') inputStr = isShift ? 'e' : '.';
    else if (action === '×') inputStr = '\\times ';
    else if (action === '÷') inputStr = '\\div ';
    else inputStr = action; // For numbers and basic ops like + - ( )

    mf.executeCommand(['insert', inputStr]);

    if (isShift && action !== 'shift') {
      setIsShift(false);
    }
    mf.focus();
  };

  type KeyType = 'shift' | 'func' | 'ctrl' | 'op' | 'eq' | 'num';

  interface KeyDefinition {
    label: string;
    action: string;
    type: KeyType;
    shiftLabel?: string;
  }

  // アプリ用に最適化・整理された5列×6行のキーボード配列
  const keys: KeyDefinition[] = [
    // 1行目: 関数系
    { label: 'SHIFT', action: 'shift', type: 'shift' },
    { label: 'x²', shiftLabel: 'x³', action: 'sqr', type: 'func' },
    { label: 'x^■', action: 'power', type: 'func' },
    { label: '√■', shiftLabel: '∛■', action: 'sqrt', type: 'func' },
    { label: 'a/b', action: 'frac', type: 'func' },
    // 2行目: 三角関数など
    { label: 'sin', shiftLabel: 'sin⁻¹', action: 'sin', type: 'func' },
    { label: 'cos', shiftLabel: 'cos⁻¹', action: 'cos', type: 'func' },
    { label: 'tan', shiftLabel: 'tan⁻¹', action: 'tan', type: 'func' },
    { label: '(', action: '(', type: 'func' },
    { label: ')', action: ')', type: 'func' },
    // 3行目: テンキー上段
    { label: '7', action: '7', type: 'num' },
    { label: '8', action: '8', type: 'num' },
    { label: '9', action: '9', type: 'num' },
    { label: 'DEL', action: 'del', type: 'ctrl' },
    { label: 'AC', action: 'ac', type: 'ctrl' },
    // 4行目: テンキー中段
    { label: '4', action: '4', type: 'num' },
    { label: '5', action: '5', type: 'num' },
    { label: '6', action: '6', type: 'num' },
    { label: '×', action: '×', type: 'op' },
    { label: '÷', action: '÷', type: 'op' },
    // 5行目: テンキー下段
    { label: '1', action: '1', type: 'num' },
    { label: '2', action: '2', type: 'num' },
    { label: '3', action: '3', type: 'num' },
    { label: '+', action: '+', type: 'op' },
    { label: '-', action: '-', type: 'op' },
    // 6行目: 最下段
    { label: '0', action: '0', type: 'num' },
    { label: '.', shiftLabel: 'e', action: '.', type: 'num' },
    { label: '×10^x', shiftLabel: 'π', action: 'exp', type: 'num' },
    { label: 'Ans', action: 'ans', type: 'func' },
    { label: '=', action: '=', type: 'eq' }
  ];

  return (
    <div className="bg-gradient-to-br from-[#1c1c1e] to-[#000000] min-h-screen text-white font-sans flex justify-center overflow-hidden selection:bg-transparent">
      <div className="w-full max-w-md h-[100dvh] flex flex-col p-4 sm:p-6 pb-8">
        
        {/* ディスプレイエリア（枠をなくし、文字を浮かせるモダンなスタイル） */}
        <div className="flex-none h-1/4 min-h-[140px] flex flex-col justify-end relative px-2 sm:px-4 py-4 mb-2">
          <div className="absolute top-2 left-2 flex gap-2">
            {isShift && <span className="text-[#ff9f0a] text-xs font-bold tracking-widest">SHIFT</span>}
            <span className="text-gray-500 text-xs font-bold tracking-widest">DEG</span>
          </div>
          
          <div className="w-full text-right text-3xl sm:text-4xl text-gray-400 break-all leading-tight mb-1 min-h-[1.5em] font-light">
            <math-field
              ref={mfRef}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'currentColor',
                outline: 'none',
                width: '100%',
                display: 'block',
                '--text-color': 'rgb(156 163 175)'
              } as React.CSSProperties}
            >
            </math-field>
          </div>
          <div className="text-right text-6xl sm:text-7xl font-light break-all tracking-tighter text-white">
            {result}
          </div>
        </div>

        {/* キーパッドエリア（丸ボタン化、配色のおしゃれ化） */}
        <div className="flex-1 grid grid-cols-5 grid-rows-6 gap-2 sm:gap-3 place-items-center w-full mx-auto mt-auto max-h-[70vh]">
          {keys.map((btn: KeyDefinition, i: number) => {
            // ボタンスタイルの出し分け
            let baseStyle = "w-full aspect-square rounded-full text-base sm:text-xl font-normal transition-all active:scale-90 flex items-center justify-center select-none cursor-pointer shadow-sm ";
            
            if (btn.type === 'shift') {
              baseStyle += isShift ? "bg-[#ff9f0a] text-white shadow-[#ff9f0a]/30 shadow-lg" : "bg-[#2c2c2e] text-[#ff9f0a] hover:bg-[#3a3a3c]";
            } else if (btn.type === 'func') {
              baseStyle += "bg-[#2c2c2e] text-gray-200 hover:bg-[#3a3a3c]";
            } else if (btn.type === 'ctrl') {
              baseStyle += "bg-[#a5a5a5] text-black hover:bg-[#d4d4d4] font-medium";
            } else if (btn.type === 'op' || btn.type === 'eq') {
              baseStyle += "bg-[#ff9f0a] text-white hover:bg-[#ffb340] font-medium text-2xl";
            } else {
              baseStyle += "bg-[#333333] text-white hover:bg-[#4a4a4d] text-2xl font-normal";
            }

            const labelToDisplay = isShift && btn.shiftLabel ? btn.shiftLabel : btn.label;
            const textScale = labelToDisplay.length > 3 ? "text-[11px] sm:text-sm font-medium tracking-tighter" : "";

            return (
              <button 
                key={i}
                className={`${baseStyle} ${textScale}`}
                onClick={() => handleKeyPress(btn.action)}
              >
                {labelToDisplay}
              </button>
            );
          })}
        </div>
        
      </div>
    </div>
  );
}