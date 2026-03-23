"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });

        if (res.ok) {
          router.push("/");
          router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Invalid PIN");
        }
      } catch {
        setError("Connection failed");
      } finally {
        setLoading(false);
      }
    },
    [pin, router]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#141414",
          border: "1px solid #333",
          borderRadius: "12px",
          padding: "40px",
          width: "320px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>🦞</div>
        <h1
          style={{
            color: "#fff",
            fontSize: "20px",
            fontWeight: 600,
            margin: "0 0 4px 0",
          }}
        >
          Mission Control
        </h1>
        <p style={{ color: "#666", fontSize: "13px", margin: "0 0 24px 0" }}>
          Enter PIN to continue
        </p>

        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••••"
          autoFocus
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: "24px",
            textAlign: "center",
            letterSpacing: "8px",
            background: "#0a0a0a",
            border: error ? "1px solid #ef4444" : "1px solid #333",
            borderRadius: "8px",
            color: "#fff",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {error && (
          <p style={{ color: "#ef4444", fontSize: "13px", margin: "8px 0 0 0" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !pin}
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "16px",
            fontSize: "14px",
            fontWeight: 600,
            background: pin && !loading ? "#fff" : "#333",
            color: pin && !loading ? "#000" : "#666",
            border: "none",
            borderRadius: "8px",
            cursor: pin && !loading ? "pointer" : "default",
          }}
        >
          {loading ? "..." : "Unlock"}
        </button>
      </form>
    </div>
  );
}
