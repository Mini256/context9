import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth-options";
import { getDeviceAuthorizationView } from "@/lib/server/device-auth";
import { DevicePageClient } from "./device-page-client";

export default async function DeviceLoginPage(props: {
  searchParams: Promise<{ code?: string }>;
}) {
  const searchParams = await props.searchParams;
  const code = searchParams.code?.trim().toUpperCase() ?? "";
  const session = await getServerSession(authOptions);
  const view = code
    ? await getDeviceAuthorizationView(code)
    : { userCode: "", status: "not_found" as const };
  const callbackPath = `/login/device?code=${encodeURIComponent(code)}`;
  const githubEnabled = Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
  );
  const emailEnabled = Boolean(
    process.env.RESEND_API_KEY && process.env.CONTEXT9_EMAIL_FROM,
  );

  return (
    <DevicePageClient
      callbackPath={callbackPath}
      code={code}
      signedInEmail={session?.user?.email ?? undefined}
      initialStatus={view.status}
      defaultProvider={githubEnabled ? "github" : emailEnabled ? "email" : "generic"}
      emailFallbackEnabled={emailEnabled}
    />
  );
}
