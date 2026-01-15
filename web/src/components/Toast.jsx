import { useEffect } from "react";

export default function Toast({ toasts, onDismiss }) {
  useEffect(() => {
    if (toasts.length === 0) return;

    // Auto-dismiss toasts after 5 seconds
    const timers = toasts.map((toast) => {
      return setTimeout(() => {
        onDismiss(toast.id);
      }, 5000);
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div style={container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            ...toastBase,
            ...(toast.type === "error" ? toastError : {}),
            ...(toast.type === "success" ? toastSuccess : {}),
            ...(toast.type === "warning" ? toastWarning : {}),
            ...(toast.type === "info" ? toastInfo : {}),
          }}
          onClick={() => onDismiss(toast.id)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={icon}>{getIcon(toast.type)}</div>
            <div style={{ flex: 1 }}>
              {toast.title && <div style={title}>{toast.title}</div>}
              <div style={message}>{toast.message}</div>
            </div>
            <button onClick={() => onDismiss(toast.id)} style={closeBtn}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function getIcon(type) {
  switch (type) {
    case "error":
      return "⚠️";
    case "success":
      return "✓";
    case "warning":
      return "⚡";
    case "info":
    default:
      return "ℹ️";
  }
}

const container = {
  position: "fixed",
  top: 20,
  right: 20,
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  maxWidth: "min(400px, calc(100vw - 40px))",
  pointerEvents: "none",
};

const toastBase = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 10,
  padding: 16,
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
  color: "#fff",
  cursor: "pointer",
  pointerEvents: "all",
  animation: "slideIn 0.3s ease-out",
};

const toastError = {
  border: "1px solid #ef4444",
  background: "#2a1a1a",
};

const toastSuccess = {
  border: "1px solid #4ade80",
  background: "#1a2a1a",
};

const toastWarning = {
  border: "1px solid #fbbf24",
  background: "#2a2a1a",
};

const toastInfo = {
  border: "1px solid #3b82f6",
  background: "#1a1a2a",
};

const icon = {
  fontSize: 18,
  lineHeight: 1,
};

const title = {
  fontWeight: 700,
  marginBottom: 4,
};

const message = {
  fontSize: 14,
  opacity: 0.9,
};

const closeBtn = {
  background: "transparent",
  border: "none",
  color: "#fff",
  cursor: "pointer",
  fontSize: 18,
  padding: 0,
  opacity: 0.6,
  lineHeight: 1,
};
