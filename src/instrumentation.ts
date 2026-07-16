import { validateEnv } from "@/lib/env";

// Next.js runs register() once when the server process starts. Validate the
// environment here so a misconfigured deployment fails fast with a clear
// message instead of erroring deep inside a request.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    validateEnv();
  }
}
