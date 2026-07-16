import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Download, FileText, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ARTIFACT_LABELS: Record<string, string> = {
  company_name: "Company Name Due Diligence",
  value_proposition: "Value Proposition",
  hypothesis_tracker: "Hypothesis Tracker",
  interview_scripts: "Customer Interview Scripts",
  problem_solution_fit: "Problem-Solution Fit Canvas",
  competitive_landscape: "Competitive Landscape Map",
  mvp_definition: "MVP Definition",
  unit_economics: "Unit Economics",
  runway_calculator: "Runway Calculator",
  pricing_experiment: "Pricing Experiment",
  pmf_dashboard: "PMF Dashboard",
  pitch_deck: "Pitch Deck",
  financial_model: "Financial Model",
  compliance_checklist: "SA Compliance Checklist",
  weekly_journal: "Weekly Journal",
  funding_tracker: "Funding Tracker",
  advisor_network: "Advisor Network",
};

export default async function ExportsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Get artifacts with their exports
  const { data: exports } = await supabase
    .from("artifact_exports")
    .select("id, format, storage_path, created_at, artifact_id, artifacts(artifact_type, title)")
    .eq("artifacts.team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Get all team artifacts for the "export now" option
  const { data: artifacts } = await supabase
    .from("artifacts")
    .select("id, artifact_type, title, updated_at")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      {/* Detoil / Notion handover export */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <FolderTree className="size-5 text-foreground shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Export for Detoil (Notion import)</h2>
            <p className="text-xs text-muted-foreground">
              Download all your deliverables laid out in the standard Detoil folder
              structure (Finance, Legal, Governance, Operations…) as a Markdown bundle.
              Import it into Notion via <strong>Import → Markdown &amp; CSV</strong> to get
              running with Detoil, with your work already filed in the right place.
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <a href={`/api/teams/${teamId}/detoil-export`}>
            <Download className="size-3.5 mr-1" />
            Download Detoil bundle (.zip)
          </a>
        </Button>
      </div>

      {/* Export history */}
      {exports && exports.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Export history</h2>
          <div className="space-y-2">
            {exports.map((exp) => {
              const art = exp.artifacts as { artifact_type: string; title: string } | null;
              return (
                <div key={exp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm">{art?.title ?? ARTIFACT_LABELS[art?.artifact_type ?? ""] ?? "Document"}</p>
                      <p className="text-xs text-muted-foreground">
                        {exp.format.toUpperCase()} · {new Date(exp.created_at).toLocaleDateString("en-ZA")}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/artifacts/${exp.artifact_id}/export?exportId=${exp.id}`}>
                      <Download className="size-3.5 mr-1" />Download
                    </a>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">No exports yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Generate documents from individual tool pages.</p>
        </div>
      )}

      {/* Available artifacts to export */}
      {artifacts && artifacts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Export from tools</h2>
          <p className="text-xs text-muted-foreground">Export a .docx document for any tool you&apos;ve completed.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {artifacts.map((art) => (
              <div key={art.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                <div>
                  <p className="text-sm">{ARTIFACT_LABELS[art.artifact_type] ?? art.title}</p>
                  <p className="text-xs text-muted-foreground">Updated {new Date(art.updated_at).toLocaleDateString("en-ZA")}</p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <a href={`/api/artifacts/${art.id}/export`}>
                    <Download className="size-3.5" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        Documents are exported as .docx files you can open in Word or Google Docs. Format and brand them yourself — SpinUp generates the content, not the final design.
      </div>
    </div>
  );
}
