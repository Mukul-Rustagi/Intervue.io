import type { ToastItem } from "../hooks/useToast";

interface ToastHostProps {
  toasts: ToastItem[];
}

export const ToastHost = ({ toasts }: ToastHostProps) => {
  return (
    <div className="toast-host" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast toast--${toast.tone}`}>
          {toast.message}
        </article>
      ))}
    </div>
  );
};
