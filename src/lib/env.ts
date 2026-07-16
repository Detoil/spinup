/**
 * Central environment configuration with fail-fast validation.
 *
 * Required variables must be present or the server refuses to boot (see
 * src/instrumentation.ts). Optional variables gate specific features (email,
 * Trello) and are reported as warnings when missing.
 */

interface EnvVar {
  key: string;
  required: boolean;
  feature?: string;
}

const ENV_VARS: EnvVar[] = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", required: true },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true },
  { key: "SUPABASE_SERVICE_ROLE_KEY", required: true },
  { key: "NEXT_PUBLIC_APP_URL", required: true },
  { key: "RESEND_API_KEY", required: false, feature: "email" },
  { key: "RESEND_FROM_EMAIL", required: false, feature: "email" },
  { key: "TRELLO_API_KEY", required: false, feature: "Trello sync" },
  { key: "TRELLO_API_SECRET", required: false, feature: "Trello sync" },
];

/**
 * Validate the process environment. Throws a clear, aggregated error listing
 * every missing REQUIRED variable. Logs a warning (does not throw) for missing
 * optional variables so operators know which features are disabled.
 */
export function validateEnv(): void {
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const { key, required, feature } of ENV_VARS) {
    if (!process.env[key] || process.env[key]?.trim() === "") {
      if (required) missingRequired.push(key);
      else missingOptional.push(`${key}${feature ? ` (${feature})` : ""}`);
    }
  }

  if (missingOptional.length > 0) {
    console.warn(
      `[env] Optional variables not set — related features are disabled: ${missingOptional.join(", ")}`
    );
  }

  if (missingRequired.length > 0) {
    throw new Error(
      `[env] Missing required environment variables: ${missingRequired.join(", ")}. ` +
        `Copy .env.example to .env.local and fill them in.`
    );
  }
}
