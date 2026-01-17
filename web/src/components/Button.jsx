// Button - Reusable button component with variants
export default function Button({
  children,
  variant = "default", // default, primary, danger, accent, ghost
  size = "medium", // small, medium, large
  disabled = false,
  onClick,
  type = "button",
  style = {},
  ...props
}) {
  const baseStyle = {
    padding: size === "small" ? "8px 12px" : size === "large" ? "16px 24px" : "12px 18px",
    borderRadius: "var(--radius-md)",
    fontSize: size === "small" ? "var(--text-sm)" : size === "large" ? "var(--text-lg)" : "var(--text-base)",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s ease",
    border: "1px solid transparent",
    minHeight: size === "small" ? "36px" : size === "large" ? "52px" : "44px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-sm)",
    opacity: disabled ? 0.5 : 1,
    ...getVariantStyle(variant),
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={baseStyle}
      {...props}
    >
      {children}
    </button>
  );
}

function getVariantStyle(variant) {
  switch (variant) {
    case "primary":
      return {
        background: "var(--text-primary)",
        color: "var(--bg-primary)",
        border: "1px solid var(--text-primary)",
      };

    case "accent":
      return {
        background: "var(--accent-primary)",
        color: "#ffffff",
        border: "2px solid var(--accent-border)",
        boxShadow: "0 0 20px var(--accent-glow)",
      };

    case "danger":
      return {
        background: "var(--danger)",
        color: "#ffffff",
        border: "1px solid var(--danger)",
      };

    case "ghost":
      return {
        background: "transparent",
        color: "var(--text-primary)",
        border: "1px solid var(--border-tertiary)",
      };

    case "default":
    default:
      return {
        background: "var(--bg-tertiary)",
        color: "var(--text-primary)",
        border: "1px solid var(--border-tertiary)",
      };
  }
}
