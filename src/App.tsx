import { ComputeEngine } from '@cortex-js/compute-engine';
import { MathfieldElement } from 'mathlive';
import { useEffect, useRef, useState } from 'react';
import { useWebHaptics } from 'web-haptics/react';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement>;
    }
  }
}

export default function App() {
  const ceRef = useRef(new ComputeEngine());
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isShift, setIsShift] = useState(false);
  const [ansValue, setAnsValue] = useState('0');
  const [preAnsValue, setPreAnsValue] = useState('0');
  const [angleMode, setAngleMode] = useState<'deg' | 'rad' | 'grad'>('deg');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });
  const mfRef = useRef<MathfieldElement>(null);
  const { trigger } = useWebHaptics();

  // Compute Engineを利用した数式評価
  const evaluateExpression = (expr: string, ans: string, preAns: string): { value: string, isError: boolean } => {
    if (!expr) return { value: "", isError: false };
    const ce = ceRef.current;
    try {
      // 角度モードの設定
      const modeMap: Record<string, "deg" | "rad" | "grad"> = {
        deg: "deg",
        rad: "rad",
        grad: "grad"
      };
      (ce as any).angularUnit = modeMap[angleMode];

      // Ansを代入するためにスコープに変数を設定
      ce.assign('Ans', ce.parse(ans));
      ce.assign('PreAns', ce.parse(preAns));
      // LaTeXの数式をパース
      const parsed = ce.parse(expr);

      // 構文エラーや入力不足のチェック
      if (!parsed.isValid) {
        const firstError = parsed.errors[0];
        // JSON表現にシリアライズして詳細を確認
        const errorJson = JSON.stringify(firstError);
        if (errorJson.includes('missing')) return { value: "Input Incomplete", isError: true };
        if (errorJson.includes('unexpected-token')) return { value: "Syntax Error", isError: true };
        return { value: "Invalid Syntax", isError: true };
      }

      // N()で数値評価
      const resultExpr = parsed.N();
      const val = resultExpr.valueOf();
      
      if (typeof val === 'number') {
        if (!isFinite(val) || isNaN(val)) return { value: "Math Error", isError: true };
        return { value: String(Math.round(val * 1e10) / 1e10), isError: false };
      }
      
      // 数値以外（シンボリックな結果など）の場合もチェック
      if (!resultExpr.isValid) return { value: "Calculation Error", isError: true };

      return { value: String(val), isError: false };
    } catch {
      return { value: "Unexpected Error", isError: true };
    }
  };

  useEffect(() => {
    if (mfRef.current) {
      mfRef.current.addEventListener('input', (evt: Event) => {
        setExpression((evt.target as MathfieldElement).value);
      });
      // Disable the default virtual keyboard
      mfRef.current.mathVirtualKeyboardPolicy = "manual";
      // Hide the menu
      mfRef.current.menuItems = [];
    }
  }, []);

  // テーマの変更をHTML要素に反映
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    trigger('light');
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleAngleMode = () => {
    trigger('light');
    setAngleMode(prev => {
      if (prev === 'deg') return 'rad';
      if (prev === 'rad') return 'grad';
      return 'deg';
    });
  };

  const handleKeyPress = (action: string) => {
    trigger([
      { duration: 25 },
      ], { intensity: 0.7 }
    );
    
    const mf = mfRef.current;
    if (!mf) return;

    // 計算結果が表示されている状態での次の入力処理
    if (result !== '' || hasError) {
      if (action === 'ac') {
        // ACは通常通り全クリア
      } else if (action === 'shift') {
        // SHIFTは状態を切り替えるだけで表示は維持
      } else if (action === '=') {
        // = は何もしない（または再計算）
      } else if (action === 'del') {
        // DELは結果表示を消して、元の数式の末尾から編集を再開
        setResult('');
        setHasError(false);
        mf.focus();
        return;
      } else {
        // その他の入力（数値、演算子、関数など）
        // 以前の数式を Ans に置き換えて入力を継続
        mf.setValue('\\operatorname{Ans}');
        setExpression('\\operatorname{Ans}');
        setResult('');
        setHasError(false);
        // もし押されたボタン自体が Ans の場合は、置き換えた時点で完了
        if (action === 'ans') {
          mf.focus();
          return;
        }
      }
    }

    if (action === 'ac') {
      mf.setValue('');
      setExpression('');
      setResult('');
      setHasError(false);
      setIsShift(false);
      mf.focus();
      return;
    }
    
    if (action === 'del') {
      mf.executeCommand('deleteBackward');
      return;
    }

    if (action === '=') {
      const res = evaluateExpression(expression, ansValue, preAnsValue);
      setResult(res.value);
      setHasError(res.isError);
      if (res.isError) {
        trigger('error');
      }
      if (!res.isError) {
        setPreAnsValue(ansValue);
        setAnsValue(res.value);
      }
      setIsShift(false);
      return;
    }

    if (action === 'shift') {
      setIsShift(!isShift);
      return;
    }

    if (action === 'frac') {
      // Insert a proper fraction with placeholders and focus numerator
      mf.executeCommand(['insert', '\\frac{#@}{#?}']);
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
    else if (action === 'ans') inputStr = isShift ? '\\operatorname{PreAns}' : '\\operatorname{Ans}';
    else if (action === 'power') inputStr = '^';
    else if (action === '.') inputStr = isShift ? 'e' : '.';
    else if (action === '×') inputStr = '\\times ';
    else if (action === '÷') inputStr = '\\div ';
    else inputStr = action; // For numbers and basic ops like + - ( )

    mf.executeCommand(['insert', inputStr]);

    if (isShift && action !== 'shift') {
      setIsShift(false);
    }
    setHasError(false); // 入力時はエラー表示をクリア
    mf.focus();
  };

  type KeyType = 'shift' | 'func' | 'ctrl' | 'op' | 'eq' | 'num';

  interface KeyDefinition {
    label: string | React.ReactNode;
    action: string;
    type: KeyType;
    shiftLabel?: string | React.ReactNode;
  }

  // アプリ用に最適化・整理された5列×6行のキーボード配列
  const keys: KeyDefinition[] = [
    // 1行目: 関数系
    { label: 'SHIFT', action: 'shift', type: 'shift' },
    { label: <span>■<sup>2</sup></span>, shiftLabel: <span>■<sup>3</sup></span>, action: 'sqr', type: 'func' },
    { label: <span>■<sup>□</sup></span>, action: 'power', type: 'func' },
    { label: '√■', shiftLabel: '∛■', action: 'sqrt', type: 'func' },
    { label: <span className="flex flex-col items-center leading-none text-xs"><span className="border-b border-current px-1">■</span><span>□</span></span>, action: 'frac', type: 'func' },
    // 2行目: 三角関数など
    { label: 'sin', shiftLabel: <span>sin<sup>-1</sup></span>, action: 'sin', type: 'func' },
    { label: 'cos', shiftLabel: <span>cos<sup>-1</sup></span>, action: 'cos', type: 'func' },
    { label: 'tan', shiftLabel: <span>tan<sup>-1</sup></span>, action: 'tan', type: 'func' },
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
    { label: <span className="text-sm">×10<sup>□</sup></span>, shiftLabel: 'π', action: 'exp', type: 'num' },
    { label: 'Ans', shiftLabel: 'PreAns', action: 'ans', type: 'func' },
    { label: '=', action: '=', type: 'eq' }
  ];

  return (
    <div className="bg-[#f9fafb] dark:bg-[#000000] w-full h-[100dvh] text-gray-900 dark:text-gray-100 font-sans flex justify-center overflow-hidden selection:bg-transparent transition-colors duration-300">
      <div className="w-full max-w-md h-full flex flex-col px-3 sm:px-6 py-4 pb-6">
          
          {/* ディスプレイエリア */}
          <div className="flex-none h-[22%] min-h-[120px] flex flex-col justify-end relative px-2 py-2 mb-2">
            {/* 左側インジケーター */}
            <div className="absolute top-0 left-0 flex gap-3 items-center">
              {isShift && <span className="text-blue-600 dark:text-blue-400 text-[10px] font-bold tracking-widest animate-pulse">SHIFT</span>}
              <button 
                onClick={toggleAngleMode}
                className="text-gray-400 dark:text-gray-500 text-[10px] font-bold tracking-widest hover:text-blue-500 dark:hover:text-blue-400 active:scale-95 transition-all outline-none select-none"
              >
                {angleMode.toUpperCase()}
              </button>
            </div>

            {/* 右側テーマ切り替え */}
            <div className="absolute top-0 right-0">
              <button 
                onClick={toggleTheme}
                className="text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1"
                title="Toggle Theme"
              >
                {theme === 'light' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>
            </div>
            
            <div className="w-full text-right text-3xl sm:text-4xl text-gray-500 dark:text-gray-400 break-all leading-tight mb-0 min-h-[1.2em] font-light">
              <math-field
                ref={mfRef}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'currentColor',
                  outline: 'none',
                  width: '100%',
                  display: 'block',
                  fontFamily: '"Poppins", sans-serif',
                  '--text-color': theme === 'dark' ? 'rgb(243 244 246)' : 'rgb(15 23 42)',
                  '--selection-background-color': 'transparent',
                  '--selection-color': 'currentColor',
                  '--placeholder-color': 'currentColor',
                  '--caret-color': 'rgb(37 99 235)',
                } as React.CSSProperties}
              >
              </math-field>
            </div>
            <div className={`text-right text-5xl sm:text-7xl font-light break-all tracking-tighter transition-colors ${hasError ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
              {result}
            </div>
          </div>

          {/* キーパッドエリア */}
          <div className="flex-1 flex flex-col justify-end pb-2">
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full mx-auto">
              {keys.map((btn: KeyDefinition, i: number) => {
                // ボタンスタイルの出し分け
                let baseStyle = "w-full aspect-square rounded-full font-normal transition-all active:scale-90 flex items-center justify-center select-none cursor-pointer ";

                if (btn.type === 'shift') {
                  baseStyle += isShift 
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.2)] text-xl sm:text-2xl" 
                    : "bg-[#e5e7eb] dark:bg-[#2c2c2e] text-blue-600 dark:text-blue-400 hover:bg-[#d1d5db] dark:hover:bg-[#3a3a3c] text-xl sm:text-2xl";
                } else if (btn.type === 'func') {
                  baseStyle += "bg-[#e5e7eb] dark:bg-[#2c2c2e] text-gray-700 dark:text-gray-300 hover:bg-[#d1d5db] dark:hover:bg-[#3a3a3c] text-xl sm:text-2xl";
                } else if (btn.type === 'ctrl') {
                  baseStyle += "bg-gray-600 dark:bg-gray-500 text-white hover:bg-gray-700 dark:hover:bg-gray-400 font-normal text-lg sm:text-xl";
                } else if (btn.type === 'op' || btn.type === 'eq') {
                  baseStyle += "bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.3)] font-medium text-4xl sm:text-5xl";
                } else {
                  baseStyle += "bg-white dark:bg-[#333333] text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#444444] border border-gray-200 dark:border-transparent text-3xl sm:text-4xl font-normal";
                }
                const labelToDisplay = isShift && btn.shiftLabel ? btn.shiftLabel : btn.label;
                const isLongLabel = typeof labelToDisplay === 'string' && labelToDisplay.length > 3;
                const textScale = isLongLabel ? "text-xs sm:text-lg font-normal tracking-tighter" : "";
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
      </div>
  );
}