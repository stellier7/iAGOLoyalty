"use client";

/**
 * Replaces the root layout when an uncaught error escapes.
 * Must define its own html/body — keep styles inline so it never depends on CSS chunks.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily: 'Arial, "Helvetica Neue", sans-serif',
          background: "linear-gradient(160deg, #f7f3ec 0%, #f4f1ea 45%, #efe8dc 100%)",
          color: "#0a0a0a",
        }}
      >
        <main
          style={{
            maxWidth: 420,
            margin: "0 auto",
            padding: "64px 24px",
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <p style={{ letterSpacing: "0.2em", textTransform: "uppercase", color: "#e8734a", fontSize: 12 }}>
            iAGO Loyalty
          </p>
          <h1 style={{ fontSize: 36, margin: "16px 0 8px", lineHeight: 1.1 }}>Something broke</h1>
          <p style={{ color: "#8c8a85", lineHeight: 1.6, marginBottom: 24 }}>
            The server hit an error after sign-in. This is not a blank crash page — you can retry or go
            back to login.
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#fbf9f4",
              border: "1px solid #ddd6c8",
              borderRadius: 12,
              padding: 16,
              fontSize: 13,
              color: "#0a0a0a",
            }}
          >
            {error.message || "Unknown error"}
            {error.digest ? `\nDigest: ${error.digest}` : ""}
          </pre>
          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "#0a0a0a",
                color: "#f4f1ea",
                border: 0,
                borderRadius: 999,
                padding: "10px 18px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/login"
              style={{
                background: "transparent",
                color: "#0a0a0a",
                border: "1px solid #0a0a0a",
                borderRadius: 999,
                padding: "10px 18px",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Back to sign in
            </a>
            <a href="/ok" style={{ color: "#8c8a85", alignSelf: "center", fontSize: 13 }}>
              Check /ok
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
