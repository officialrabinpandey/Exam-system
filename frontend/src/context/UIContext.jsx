import { createContext, useCallback, useContext, useRef, useState } from "react";

const UIContext = createContext(null);

let toastIdCounter = 0;

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null); // { message, resolve }
  const resolveRef = useRef(null);

  const showToast = useCallback((message, type = "success") => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfirmState({ message });
    });
  }, []);

  const handleConfirmChoice = (choice) => {
    setConfirmState(null);
    if (resolveRef.current) resolveRef.current(choice);
  };

  return (
    <UIContext.Provider value={{ showToast, confirm }}>
      {children}

      <div className="toast-stack no-print">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`} onClick={() => dismissToast(t.id)}>
            {t.message}
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="modal-overlay no-print">
          <div className="modal-card">
            <p>{confirmState.message}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => handleConfirmChoice(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => handleConfirmChoice(true)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
