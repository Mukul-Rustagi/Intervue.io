import { createContext, useContext } from "react";

export interface ToastItem {
  id: string;
  message: string;
  tone: "error" | "success" | "info";
}

export interface ToastContextValue {
  addToast: (message: string, tone?: ToastItem["tone"]) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastContext provider.");
  }

  return context;
};
