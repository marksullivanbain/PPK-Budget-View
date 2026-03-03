import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface DemoModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  maskPracticeName: (name: string) => string;
  isDemoPractice: (name: string) => boolean;
}

const DEMO_PRACTICE_SOURCE = "ENR Practice";
const DEMO_PRACTICE_DISPLAY = "Sample Practice";
const DEMO_KEYWORDS = ["ENR", "enr"];

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: false,
  toggleDemoMode: () => {},
  maskPracticeName: (name: string) => name,
  isDemoPractice: () => false,
});

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode(prev => !prev);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        toggleDemoMode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleDemoMode]);

  const maskPracticeName = useCallback((name: string) => {
    if (!isDemoMode) return name;
    if (name === DEMO_PRACTICE_SOURCE) return DEMO_PRACTICE_DISPLAY;
    if (DEMO_KEYWORDS.some(kw => name.includes(kw))) return name.replace(/ENR/gi, "Sample");
    return name;
  }, [isDemoMode]);

  const isDemoPractice = useCallback((name: string) => {
    if (!isDemoMode) return false;
    return name === DEMO_PRACTICE_SOURCE || name === DEMO_PRACTICE_DISPLAY || DEMO_KEYWORDS.some(kw => name.includes(kw));
  }, [isDemoMode]);

  return (
    <DemoModeContext.Provider value={{ isDemoMode, toggleDemoMode, maskPracticeName, isDemoPractice }}>
      {isDemoMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 text-black text-center text-xs py-1 font-medium pointer-events-none">
          DEMO MODE — Press Ctrl+Shift+D to exit
        </div>
      )}
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}

export function BlurredText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`blur-sm select-none ${className || ''}`}>{children}</span>;
}
