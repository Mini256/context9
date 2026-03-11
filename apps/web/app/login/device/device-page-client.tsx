"use client";

import { useState } from "react";

interface DevicePageClientProps {
  callbackPath: string;
  code: string;
  signedInEmail?: string;
  initialStatus: "pending" | "approved" | "expired" | "consumed" | "not_found";
  defaultProvider: "github" | "email" | "generic";
  emailFallbackEnabled: boolean;
}

export function DevicePageClient(props: DevicePageClientProps) {
  const [status, setStatus] = useState(props.initialStatus);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const signInUrl =
    props.defaultProvider === "github"
      ? `/api/auth/signin/github?callbackUrl=${encodeURIComponent(props.callbackPath)}`
      : props.defaultProvider === "email"
        ? `/api/auth/signin/email?callbackUrl=${encodeURIComponent(props.callbackPath)}`
        : `/api/auth/signin?callbackUrl=${encodeURIComponent(props.callbackPath)}`;

  async function handleApprove() {
    setSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch("/api/auth/device/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userCode: props.code,
        }),
      });

      const data = (await response.json()) as { error?: string; status?: string };
      if (!response.ok) {
        throw new Error(data.error ?? `Request failed with ${response.status}`);
      }

      setStatus("approved");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : String(requestError),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "96px 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#64748b" }}>
        Context9
      </p>
      <h1 style={{ fontSize: 40, lineHeight: 1.1, marginTop: 12 }}>
        Device login
      </h1>
      <p style={{ marginTop: 16, color: "#475569", lineHeight: 1.7 }}>
        Confirm this code in your browser to finish signing in on the CLI.
      </p>
      <div
        style={{
          marginTop: 24,
          padding: 20,
          borderRadius: 16,
          border: "1px solid #cbd5e1",
          background: "#f8fafc",
        }}
      >
        <div style={{ fontSize: 14, color: "#64748b" }}>Code</div>
        <div style={{ marginTop: 8, fontSize: 32, fontWeight: 700, letterSpacing: "0.08em" }}>
          {props.code}
        </div>
      </div>

      {status === "not_found" ? (
        <p style={{ marginTop: 24, color: "#b91c1c" }}>
          This code was not found.
        </p>
      ) : null}

      {status === "expired" ? (
        <p style={{ marginTop: 24, color: "#b91c1c" }}>
          This code has expired. Go back to the CLI and start again.
        </p>
      ) : null}

      {status === "consumed" ? (
        <p style={{ marginTop: 24, color: "#475569" }}>
          This device code was already used.
        </p>
      ) : null}

      {status === "approved" ? (
        <p style={{ marginTop: 24, color: "#166534" }}>
          Device approved. You can return to the CLI.
        </p>
      ) : null}

      {!props.signedInEmail &&
      status !== "not_found" &&
      status !== "expired" &&
      status !== "consumed" ? (
        <div style={{ marginTop: 32 }}>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>
            Sign in first. If this is your first time, a new account will be
            created after verification.
          </p>
          <a
            href={signInUrl}
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "12px 18px",
              borderRadius: 12,
              background: "#0f172a",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            {props.defaultProvider === "github"
              ? "Continue with GitHub"
              : "Continue to sign in"}
          </a>
          {props.defaultProvider === "github" && props.emailFallbackEnabled ? (
            <a
              href={`/api/auth/signin/email?callbackUrl=${encodeURIComponent(props.callbackPath)}`}
              style={{
                display: "inline-block",
                marginTop: 14,
                marginLeft: 16,
                color: "#475569",
                textDecoration: "none",
              }}
            >
              Use email instead
            </a>
          ) : null}
        </div>
      ) : null}

      {props.signedInEmail && status === "pending" ? (
        <div style={{ marginTop: 32 }}>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>
            Signed in as <strong>{props.signedInEmail}</strong>.
          </p>
          <button
            type="button"
            onClick={handleApprove}
            disabled={submitting}
            style={{
              marginTop: 16,
              padding: "12px 18px",
              borderRadius: 12,
              border: "none",
              background: "#0f172a",
              color: "#fff",
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting ? "Approving..." : "Approve device"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p style={{ marginTop: 16, color: "#b91c1c" }}>{error}</p>
      ) : null}
    </main>
  );
}
