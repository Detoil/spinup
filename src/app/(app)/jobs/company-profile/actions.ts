"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { companyProfileSchema } from "@/lib/jobs/schemas";

export async function saveCompanyProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const companyId = formData.get("company_id") as string;

  let data;
  try {
    data = companyProfileSchema.parse(JSON.parse(formData.get("data") as string));
  } catch {
    return { error: "Invalid company profile data" };
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("jb_company_members")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { error: "Not a member of this company" };

  const { error } = await supabase
    .from("jb_companies")
    .update({
      name: data.name,
      what_we_do: data.what_we_do || null,
      how_we_work: data.how_we_work || null,
      website_url: data.website_url || null,
      team_linkedin: data.team_linkedin,
    })
    .eq("id", companyId);

  if (error) return { error: error.message };

  revalidatePath("/jobs/company-profile");
  return { error: null };
}
