import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface CostCenterContextType {
  selectedCostCenterId: string;
  setSelectedCostCenterId: (id: string) => void;
}

const CostCenterContext = createContext<CostCenterContextType>({
  selectedCostCenterId: "",
  setSelectedCostCenterId: () => {},
});

export function CostCenterProvider({ children }: { children: ReactNode }) {
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>("");

  return (
    <CostCenterContext.Provider value={{ selectedCostCenterId, setSelectedCostCenterId }}>
      {children}
    </CostCenterContext.Provider>
  );
}

export function useCostCenter() {
  return useContext(CostCenterContext);
}
