"use server";

import { createClient } from "@/lib/supabase/server";

export async function completeOnboarding() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  // Always act on the authenticated user — never a client-supplied id.
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);

  if (error) {
    throw new Error("Failed to complete onboarding: " + error.message);
  }
}
