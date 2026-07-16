import JSZip from "jszip";
import { ARTIFACT_TYPES } from "@/lib/artifacts/types";
import type { ValueProposition } from "@/lib/types/database";

/**
 * Detoil handover export.
 *
 * Takes a team's SpinUp deliverables and lays them out as a Markdown bundle
 * matching the standard Detoil Google Drive folder structure. The resulting
 * .zip imports straight into Notion via "Import → Markdown & CSV" (folders
 * become nested pages), so a founder can graduate from SpinUp into a Detoil
 * setup with their work already filed in the right place.
 */

// The eight top-level Detoil categories and their standard sub-areas.
// Mirrors the "Standard folder structure" in the Detoil product spec.
export const DETOIL_STRUCTURE: { category: string; subfolders: string[] }[] = [
  { category: "Finance", subfolders: ["Bank Statements", "Customer Invoices", "Supplier Invoices", "Management Accounts", "Annual Financial Statements", "Expenses", "Grants & Funding", "Supplier Accounts"] },
  { category: "Tax", subfolders: ["EMP201", "EMP501", "Provisional Tax", "ITR14", "TCS Certificates"] },
  { category: "HR", subfolders: ["Payslips", "Employees", "Contractors"] },
  { category: "Governance", subfolders: ["Board Minutes", "Resolutions", "Shareholder Updates", "MOI & Shareholder Agreements"] },
  { category: "Legal", subfolders: ["CIPC", "BBBEE", "IP & Licences", "Contracts", "NDAs"] },
  { category: "Sales", subfolders: ["Customers", "Proposals", "Orders"] },
  { category: "Marketing", subfolders: [] },
  { category: "Operations", subfolders: ["Templates", "Runbooks", "Registers"] },
];

// Where each SpinUp artifact type is filed in the Detoil structure.
// `sub` is a hint recorded in the document's front matter (files are placed at
// category level to keep the Notion import tree clean).
const ARTIFACT_FOLDER_MAP: Record<string, { category: string; sub?: string }> = {
  company_name: { category: "Legal", sub: "CIPC" },
  value_proposition: { category: "Operations" },
  hypothesis_tracker: { category: "Operations" },
  interview_scripts: { category: "Sales" },
  problem_solution_fit: { category: "Operations" },
  competitive_landscape: { category: "Marketing" },
  mvp_definition: { category: "Operations" },
  unit_economics: { category: "Finance" },
  runway_calculator: { category: "Finance" },
  pricing_experiment: { category: "Sales" },
  pmf_dashboard: { category: "Operations" },
  pitch_deck: { category: "Governance" },
  financial_model: { category: "Finance", sub: "Management Accounts" },
  compliance_checklist: { category: "Legal" },
  scaling_readiness: { category: "Operations" },
  gtm_playbook: { category: "Sales" },
  scale_unit_economics: { category: "Finance" },
  retention_tracker: { category: "Finance" },
  hiring_planner: { category: "HR" },
  founder_ceo_tracker: { category: "Governance" },
  okr_tracker: { category: "Operations" },
  process_docs: { category: "Operations", sub: "Runbooks" },
  board_toolkit: { category: "Governance" },
  scale_financial_model: { category: "Finance", sub: "Management Accounts" },
  fundraising_pipeline: { category: "Finance", sub: "Grants & Funding" },
  market_expansion: { category: "Marketing" },
  weekly_journal: { category: "Operations" },
  funding_tracker: { category: "Finance", sub: "Grants & Funding" },
  advisor_network: { category: "Governance" },
};

const DEFAULT_FOLDER = { category: "Operations", sub: "Registers" };

const ARTIFACT_LABELS: Record<string, string> = Object.fromEntries(
  ARTIFACT_TYPES.map((t) => [t.id, t.label])
);

// Artifact types whose canonical data lives in dedicated tables and is rendered
// separately below — skip them in the generic artifacts loop to avoid dupes.
const DEDICATED_TABLE_TYPES = new Set(["weekly_journal", "funding_tracker", "advisor_network"]);

// ---- Markdown helpers ----

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isScalar(v: unknown): v is string | number | boolean {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

function formatScalar(v: string | number | boolean): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/** Recursively render arbitrary artifact `data` into readable Markdown. */
function renderObject(obj: Record<string, unknown>, headingLevel = 3): string[] {
  const lines: string[] = [];
  const hashes = "#".repeat(Math.min(headingLevel, 6));

  for (const [key, value] of Object.entries(obj)) {
    if (isEmpty(value)) continue;
    const label = humanize(key);

    if (isScalar(value)) {
      lines.push(`**${label}:** ${formatScalar(value)}`, "");
    } else if (Array.isArray(value)) {
      lines.push(`${hashes} ${label}`, "");
      if (value.every(isScalar)) {
        for (const item of value) lines.push(`- ${formatScalar(item as string)}`);
        lines.push("");
      } else {
        value.forEach((item, i) => {
          lines.push(`**${label} ${i + 1}**`, "");
          if (item && typeof item === "object") {
            lines.push(...renderObject(item as Record<string, unknown>, headingLevel + 1));
          } else if (!isEmpty(item)) {
            lines.push(String(item), "");
          }
        });
      }
    } else if (value && typeof value === "object") {
      lines.push(`${hashes} ${label}`, "");
      lines.push(...renderObject(value as Record<string, unknown>, headingLevel + 1));
    }
  }

  return lines;
}

function vpSentence(vp: ValueProposition | null): string | null {
  if (!vp) return null;
  return `Our product **${vp.solution}** helps **${vp.customer}** achieve **${vp.benefit}** by ${vp.how_it_works}, an improvement of ${vp.improvement} over current options.`;
}

function docHeader(title: string, meta: Record<string, string | undefined>): string {
  const metaLines = Object.entries(meta)
    .filter(([, v]) => v)
    .map(([k, v]) => `> **${k}:** ${v}`)
    .join("\n");
  return `# ${title}\n\n${metaLines}\n`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
}

// ---- Bundle input ----

export interface DetoilTeam {
  name: string;
  operating_name: string | null;
  current_phase: string;
  value_proposition: ValueProposition | null;
}

export interface DetoilArtifact {
  artifact_type: string;
  title: string;
  data: Record<string, unknown>;
  updated_at: string;
}

export interface DetoilJournalEntry {
  week_start: string;
  what_we_did: string | null;
  what_we_learned: string | null;
  what_changed: string | null;
  blockers: string | null;
  next_week_priority: string | null;
}

export interface DetoilFundingEntry {
  funder: string;
  amount_available: number | null;
  stage_fit: string | null;
  status: string;
  deadline: string | null;
  notes: string | null;
  url: string | null;
}

export interface DetoilAdvisorEntry {
  name: string;
  expertise: string | null;
  relationship_stage: string;
  how_we_know_them: string | null;
  next_action: string | null;
}

export interface DetoilExportInput {
  team: DetoilTeam;
  artifacts: DetoilArtifact[];
  journal: DetoilJournalEntry[];
  funding: DetoilFundingEntry[];
  advisors: DetoilAdvisorEntry[];
}

// ---- Bundle builder ----

/**
 * Build the Detoil handover bundle as a zip Buffer. `files` maps zip path →
 * markdown content; a parent `<Category>.md` is emitted for each populated
 * category so Notion nests the documents under it.
 */
export async function buildDetoilBundle(input: DetoilExportInput): Promise<Buffer> {
  const { team, artifacts, journal, funding, advisors } = input;
  const companyName = team.operating_name || team.name || "Company";
  const root = `SpinUp Handover — ${sanitizeFilename(companyName)}`;

  // category -> list of { filename, content }
  const filed = new Map<string, { filename: string; content: string }[]>();
  const fileInto = (category: string, filename: string, content: string) => {
    const list = filed.get(category) ?? [];
    list.push({ filename: sanitizeFilename(filename), content });
    filed.set(category, list);
  };

  // 1. Deliverables from the artifacts table
  for (const art of artifacts) {
    if (DEDICATED_TABLE_TYPES.has(art.artifact_type)) continue;
    const map = ARTIFACT_FOLDER_MAP[art.artifact_type] ?? DEFAULT_FOLDER;
    const label = ARTIFACT_LABELS[art.artifact_type] ?? art.title ?? humanize(art.artifact_type);

    const body: string[] = [];
    const vp = vpSentence(team.value_proposition);
    if (vp && art.artifact_type !== "value_proposition") {
      body.push(`> _Value proposition:_ ${vp}`, "");
    }
    if (art.artifact_type === "value_proposition" && vp) {
      body.push(vp, "");
    }
    body.push(...renderObject(art.data ?? {}));

    const content =
      docHeader(label, {
        Company: companyName,
        "Detoil area": map.sub ? `${map.category} / ${map.sub}` : map.category,
        Updated: art.updated_at ? new Date(art.updated_at).toLocaleDateString("en-ZA") : undefined,
        Source: "SpinUp",
      }) +
      "\n" +
      (body.join("\n").trim() || "_No content captured yet._") +
      "\n";

    fileInto(map.category, `${label}.md`, content);
  }

  // 2. Funding tracker (dedicated table) -> Finance / Grants & Funding
  if (funding.length > 0) {
    const rows = funding
      .map(
        (f) =>
          `| ${f.funder} | ${f.amount_available != null ? "R " + f.amount_available.toLocaleString("en-ZA") : "—"} | ${f.stage_fit ?? "—"} | ${f.status} | ${f.deadline ?? "—"} | ${f.url ? `[link](${f.url})` : "—"} |`
      )
      .join("\n");
    const content =
      docHeader("Funding Application Tracker", { Company: companyName, "Detoil area": "Finance / Grants & Funding", Source: "SpinUp" }) +
      `\n| Funder | Amount | Stage fit | Status | Deadline | Link |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n`;
    fileInto("Finance", "Funding Application Tracker.md", content);
  }

  // 3. Advisor network (dedicated table) -> Governance
  if (advisors.length > 0) {
    const blocks = advisors
      .map((a) =>
        [
          `### ${a.name}`,
          a.expertise ? `**Expertise:** ${a.expertise}` : "",
          `**Relationship stage:** ${a.relationship_stage}`,
          a.how_we_know_them ? `**How we know them:** ${a.how_we_know_them}` : "",
          a.next_action ? `**Next action:** ${a.next_action}` : "",
        ]
          .filter(Boolean)
          .join("\n\n")
      )
      .join("\n\n");
    const content =
      docHeader("Advisor & Mentor Network", { Company: companyName, "Detoil area": "Governance", Source: "SpinUp" }) +
      "\n" + blocks + "\n";
    fileInto("Governance", "Advisor & Mentor Network.md", content);
  }

  // 4. Weekly journal (dedicated table) -> Operations
  if (journal.length > 0) {
    const blocks = journal
      .map((e) =>
        [
          `### Week of ${e.week_start}`,
          e.what_we_did ? `**What we did:** ${e.what_we_did}` : "",
          e.what_we_learned ? `**What we learned:** ${e.what_we_learned}` : "",
          e.what_changed ? `**What changed:** ${e.what_changed}` : "",
          e.blockers ? `**Blockers:** ${e.blockers}` : "",
          e.next_week_priority ? `**Next week's priority:** ${e.next_week_priority}` : "",
        ]
          .filter(Boolean)
          .join("\n\n")
      )
      .join("\n\n---\n\n");
    const content =
      docHeader("Weekly Progress Journal", { Company: companyName, "Detoil area": "Operations", Source: "SpinUp" }) +
      "\n" + blocks + "\n";
    fileInto("Operations", "Weekly Progress Journal.md", content);
  }

  // ---- Assemble the zip ----
  const zip = new JSZip();
  const rootFolder = zip.folder(root)!;

  // Start-here + company overview at the root
  rootFolder.file("00 — Start Here.md", startHereDoc(companyName));
  rootFolder.file("Company Overview.md", companyOverviewDoc(team, companyName));

  for (const { category, subfolders } of DETOIL_STRUCTURE) {
    const docs = filed.get(category) ?? [];
    // Parent page describing the Detoil category + its standard sub-areas.
    rootFolder.file(`${category}.md`, categoryDoc(category, subfolders, docs.length));
    // Child documents live in a same-named folder so Notion nests them.
    if (docs.length > 0) {
      const folder = rootFolder.folder(category)!;
      for (const d of docs) folder.file(d.filename, d.content);
    }
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

function startHereDoc(companyName: string): string {
  return `# Start Here — ${companyName} Detoil Handover

This bundle contains your SpinUp deliverables, organised into the standard
**Detoil** company folder structure so you can get running with Detoil quickly.

## How to import into Notion

1. In Notion, click **Settings → Import** (or the **Import** button at the
   bottom of the sidebar).
2. Choose **Markdown & CSV**.
3. Select the **.zip** file you downloaded (or unzip it and select the folder).
4. Notion recreates this folder tree as a nested set of pages.

## What's inside

Each top-level page below matches a Detoil folder. Your completed SpinUp tools
have been filed into the most relevant one, with a note of the exact Detoil
area in each document's header.

- **Finance** · **Tax** · **HR** · **Governance** · **Legal** · **Sales** ·
  **Marketing** · **Operations**

Empty categories are included too, so the full Detoil structure is ready for you
to drop in your own operational documents.
`;
}

function companyOverviewDoc(team: DetoilTeam, companyName: string): string {
  const vp = vpSentence(team.value_proposition);
  const phase = humanize(team.current_phase || "");
  return (
    docHeader("Company Overview", { Company: companyName, Phase: phase, Source: "SpinUp" }) +
    "\n" +
    (team.operating_name && team.operating_name !== team.name ? `**Registered name:** ${team.name}\n\n` : "") +
    (vp ? `## Value proposition\n\n${vp}\n` : "") +
    "\n_This overview seeds the Detoil Company Bible. Facts here map to the NocoDB Company Identity table; behavioural preferences are captured during Detoil onboarding._\n"
  );
}

function categoryDoc(category: string, subfolders: string[], docCount: number): string {
  const sub =
    subfolders.length > 0
      ? `### Standard Detoil sub-areas\n\n${subfolders.map((s) => `- ${s}`).join("\n")}\n`
      : "";
  const filedNote =
    docCount > 0
      ? `\nYour SpinUp deliverables filed here appear as sub-pages of this page.\n`
      : `\n_No SpinUp deliverables were filed here. This page holds the Detoil ${category} structure for you to populate._\n`;
  return `# ${category}\n\n${sub}${filedNote}`;
}
