import { useState } from 'react';

export default function App() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const [isShift, setIsShift] = useState(false);
  const [ansValue, setAnsValue] = useState('0');

  // 簡易的な数式評価エンジン
  const evaluateExpression = (expr, ans) => {
    if (!expr) return "";
    let p = expr;
    
    // Ansの置換
    p = p.replace(/Ans/g, `(${ans})`);

    // 特殊文字の置換
    p = p.replace(/×/g, '*').replace(/÷/g, '/');
    p = p.replace(/π/g, 'Math.PI').replace(/e/g, 'Math.E');
    p = p.replace(/√\(/g, 'Math.sqrt(');
    p = p.replace(/∛\(/g, 'Math.cbrt(');
    p = p.replace(/sin\(/g, 'sin_deg(');
    p = p.replace(/cos\(/g, 'cos_deg(');
    p = p.replace(/tan\(/g, 'tan_deg(');
    p = p.replace(/sin⁻¹\(/g, 'asin_deg(');
    p = p.replace(/cos⁻¹\(/g, 'acos_deg(');
    p = p.replace(/tan⁻¹\(/g, 'atan_deg(');
    p = p.replace(/log\(/g, 'Math.log10(');
    p = p.replace(/ln\(/g, 'Math.log(');
    
    // 累乗の処理
    p = p.replace(/\^2/g, '**2');
    p = p.replace(/\^3/g, '**3');
    p = p.replace(/\^/g, '**');

    // 省略された掛け算の補完
    p = p.replace(/(\d)\(/g, '$1*('); 
    p = p.replace(/\)(\d)/g, ')*$1'); 
    p = p.replace(/\)\(/g, ')*('); 
    p = p.replace(/(\d)Math\./g, '$1*Math.');
    
    // 括弧の自動補完
    const openCount = (p.match(/\(/g) || []).length;
    const closeCount = (p.match(/\)/g) || []).length;
    if (openCount > closeCount) {
      p += ')'.repeat(openCount - closeCount);
    }

    try {
      const sin_deg = (deg) => Math.sin(deg * Math.PI / 180);
      const cos_deg = (deg) => Math.cos(deg * Math.PI / 180);
      const tan_deg = (deg) => Math.tan(deg * Math.PI / 180);
      const asin_deg = (val) => Math.asin(val) * 180 / Math.PI;
      const acos_deg = (val) => Math.acos(val) * 180 / Math.PI;
      const atan_deg = (val) => Math.atan(val) * 180 / Math.PI;
      
      // eslint-disable-next-line no-new-func
      const res = new Function('sin_deg', 'cos_deg', 'tan_deg', 'asin_deg', 'acos_deg', 'atan_deg', `return ${p}`)(sin_deg, cos_deg, tan_deg, asin_deg, acos_deg, atan_deg);
      
      if (!isFinite(res) || isNaN(res)) return "Math Error";
      
      const rounded = Math.round(res * 1e10) / 1e10;
      return String(rounded);
    } catch (e) {
      return "Syntax Error";
    }
  };

  const handleKeyPress = (action, label, shiftLabel) => {
    if (navigator.vibrate) navigator.vibrate(10);
    
    const currentLabel = isShift && shiftLabel ? shiftLabel : label;

    if (action === 'ac') {
      setExpression('');
      setResult('');
      setIsShift(false);
      return;
    }
    
    if (action === 'del') {
      setExpression(prev => prev.slice(0, -1));
      return;
    }

    if (action === '=') {
      if (!expression) return;
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

    // 入力文字の整形
    let input = currentLabel;
    if (['sin', 'cos', 'tan', 'log', 'ln'].includes(action) || ['sin⁻¹', 'cos⁻¹', 'tan⁻¹'].includes(currentLabel)) {
      input = currentLabel + '(';
    } else if (action === 'sqrt') {
      input = isShift ? '∛(' : '√(';
    } else if (action === 'sqr') {
      input = isShift ? '^3' : '^2';
    } else if (action === 'ans') {
      input = 'Ans';
    } else if (action === 'exp') {
      input = isShift ? 'π' : '×10^';
    } else if (action === 'power') {
      input = '^';
    } else if (action === 'frac') {
      input = '/';
    } else if (action === '.') {
      input = isShift ? 'e' : '.';
    }

    setExpression(prev => prev + input);
    
    if (isShift && action !== 'shift') {
      setIsShift(false);
    }
  };

  // アプリ用に最適化・整理された5列×6行のキーボード配列
  const keys = [
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
          
          <div className="text-right text-3xl sm:text-4xl text-gray-400 break-all leading-tight mb-1 min-h-[1.5em] font-light">
            {expression}
          </div>
          <div className="text-right text-6xl sm:text-7xl font-light break-all tracking-tighter text-white">
            {result}
          </div>
        </div>

        {/* キーパッドエリア（丸ボタン化、配色のおしゃれ化） */}
        <div className="flex-1 grid grid-cols-5 grid-rows-6 gap-2 sm:gap-3 place-items-center w-full mx-auto mt-auto max-h-[70vh]">
          {keys.map((btn, i) => {
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
                onClick={() => handleKeyPress(btn.action, btn.label, btn.shiftLabel)}
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