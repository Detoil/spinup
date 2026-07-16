"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicantPreferencesSchema } from "@/lib/jobs/schemas";

export async function savePreferences(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const profileId = formData.get("profile_id") as string;
  if (!profileId) return { error: "Missing profile" };

  let data;
  try {
    data = applicantPreferencesSchema.parse(JSON.parse(formData.get("data") as string));
  } catch {
    return { error: "Invalid preferences data" };
  }

  const admin = createAdminClient();

  // The admin client bypasses RLS, so we MUST verify the target profile belongs
  // to the current user before writing — otherwise any user could overwrite
  // another applicant's preferences by passing their profile id.
  const { data: owned } = await admin
    .from("jb_applicant_profiles")
    .select("id")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owned) return { error: "Not authorized" };

  const { error } = await admin
    .from("jb_applicant_preferences")
    .upsert(
      {
        applicant_profile_id: profileId,
        job_types: data.job_types,
        availability_type: data.availability_type,
        available_from: data.available_from || null,
        available_until: data.available_until || null,
        work_modes: data.work_modes,
      },
      { onConflict: "applicant_profile_id" }
    );

  if (error) return { error: error.message };

  revalidatePath("/jobs/preferences");
  return { error: null };
}
