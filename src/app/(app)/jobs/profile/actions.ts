"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { applicantProfileSchema } from "@/lib/jobs/schemas";

export async function saveApplicantProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const profileId = formData.get("profile_id") as string;

  let data;
  try {
    data = applicantProfileSchema.parse(JSON.parse(formData.get("data") as string));
  } catch {
    return { error: "Invalid profile data" };
  }

  const { error } = await supabase
    .from("jb_applicant_profiles")
    .update({
      academics: data.academics,
      software_skills: data.software_skills,
      languages: data.languages,
      location_city: data.location_city || null,
      location_country: data.location_country || null,
      willing_to_relocate: data.willing_to_relocate ?? false,
      work_experience: data.work_experience,
      personality_description: data.personality_description || null,
      looking_for: data.looking_for || null,
    })
    .eq("id", profileId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/jobs/profile");
  return { error: null };
}

export async function togglePublish(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const profileId = formData.get("profile_id") as string;
  const published = formData.get("is_published") === "true";

  const { error } = await supabase
    .from("jb_applicant_profiles")
    .update({ is_published: published })
    .eq("id", profileId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/jobs/profile");
}
