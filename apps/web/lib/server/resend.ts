import "server-only";

import { Resend } from "resend";
import { optionalEnv, requireEnv } from "./env";

let resendClient: Resend | undefined;

function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(requireEnv("RESEND_API_KEY"));
  }

  return resendClient;
}

export function isResendConfigured(): boolean {
  return Boolean(
    optionalEnv("RESEND_API_KEY") && optionalEnv("CONTEXT9_EMAIL_FROM"),
  );
}

export async function sendMagicLinkEmail(input: {
  to: string;
  url: string;
  expires: Date;
}): Promise<void> {
  const resend = getResendClient();
  const from = requireEnv("CONTEXT9_EMAIL_FROM");
  const expiresAt = input.expires.toISOString();

  await resend.emails.send({
    from,
    to: [input.to],
    subject: "Sign in to Context9",
    text: [
      "Use this link to sign in to Context9:",
      input.url,
      "",
      `This link expires at ${expiresAt}.`,
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <h2>Sign in to Context9</h2>
        <p>Use the link below to sign in:</p>
        <p><a href="${input.url}">${input.url}</a></p>
        <p>This link expires at ${expiresAt}.</p>
      </div>
    `,
  });
}
