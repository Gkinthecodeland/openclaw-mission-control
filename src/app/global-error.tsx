"use client";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "monospace", padding: "2rem" }}>
        <h1>Client Error</h1>
        <pre style={{ whiteSpace: "pre-wrap", color: "red" }}>
          {error.message}
        </pre>
        <pre style={{ whiteSpace: "pre-wrap", color: "#666", fontSize: "12px" }}>
          {error.stack}
        </pre>
      </body>
    </html>
  );
}
