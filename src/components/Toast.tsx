export type ToastKind = 'success' | 'error';
export type Notify = (message: string, kind?: ToastKind) => void;

export interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
}

export function Toast({ toast }: { toast: ToastMessage | null }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
