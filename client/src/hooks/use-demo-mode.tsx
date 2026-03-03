import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface DemoModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  maskPracticeName: (name: string) => string;
}

const DEMO_PRACTICE_SOURCE = "ENR Practice";
const DEMO_PRACTICE_DISPLAY = "Sample Practice";

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: false,
  toggleDemoMode: () => {},
  maskPracticeName: (name: string) => name,
});

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode(prev => {
      const next = !prev;
      return next;
    });
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
    return name === DEMO_PRACTICE_SOURCE ? DEMO_PRACTICE_DISPLAY : name;
  }, [isDemoMode]);

  return (
    <DemoModeContext.Provider value={{ isDemoMode, toggleDemoMode, maskPracticeName }}>
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
