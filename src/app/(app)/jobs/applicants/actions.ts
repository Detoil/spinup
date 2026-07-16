"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleFavourite(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const companyId = formData.get("company_id") as string;
  const applicantProfileId = formData.get("applicant_profile_id") as string;
  const action = formData.get("action") as string;

  // Verify the user belongs to the company before touching its favourites.
  const { data: membership } = await supabase
    .from("jb_company_members")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return;

  if (action === "remove") {
    await supabase
      .from("jb_favourites")
      .delete()
      .eq("company_id", companyId)
      .eq("applicant_profile_id", applicantProfileId);
  } else {
    await supabase
      .from("jb_favourites")
      .upsert(
        {
          company_id: companyId,
          applicant_profile_id: applicantProfileId,
          favourited_by: user.id,
        },
        { onConflict: "company_id,applicant_profile_id", ignoreDuplicates: true }
      );
  }

  revalidatePath("/jobs/applicants");
  revalidatePath("/jobs/favourites");
}
