import { useState } from "react";

export default function GuessInput({ onSubmit }) {
  const [text, setText] = useState("");

  return (
    <div style={{ marginTop: 8 }}>
      <h4 style={{ margin: "8px 0", color: "#fff" }}>Guess</h4>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="type your guess..."
          style={inputStyle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = text.trim();
              if (!v) return;
              onSubmit(v);
              setText("");
            }
          }}
        />
        <button
          onClick={() => {
            const v = text.trim();
            if (!v) return;
            onSubmit(v);
            setText("");
          }}
          style={buttonStyle}
        >
          Guess
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid #444",
  background: "#2a2a2a",
  color: "#fff",
  fontSize: 16,
  outline: "none",
  minHeight: 44,
};

const buttonStyle = {
  padding: "12px 20px",
  borderRadius: 8,
  border: "1px solid #4ade80",
  background: "#4ade80",
  color: "#000",
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 0.2s",
  fontSize: 14,
  minHeight: 44,
};
