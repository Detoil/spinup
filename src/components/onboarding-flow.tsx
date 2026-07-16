"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { completeOnboarding } from "@/app/(app)/onboarding/actions";
import {
  ArrowRight,
  ArrowLeft,
  Rocket,
  FlaskConical,
  AlertTriangle,
  Layers,
} from "lucide-react";

const TOTAL_STEPS = 4;

export function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleNext() {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    }
  }

  function handleBack() {
    if (step > 0) {
      setStep(step - 1);
    }
  }

  function handleComplete() {
    startTransition(async () => {
      await completeOnboarding();
      router.push("/team/create");
    });
  }

  const progressValue = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="mb-6 flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">SpinUp</h1>
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of {TOTAL_STEPS}
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <Progress value={progressValue} className="mb-6" />

        {step === 0 && <StepWhyStartupsFail />}
        {step === 1 && <StepScientificApproach />}
        {step === 2 && <StepCommonTraps />}
        {step === 3 && <StepHowSpinUpWorks />}

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
          >
            <ArrowLeft />
            Back
          </Button>

          {step < TOTAL_STEPS - 1 ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={isPending}>
              <Rocket className="size-4" />
              {isPending ? "Setting up..." : "Let's Go"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 1 — Why Most Startups Fail                                           */
/* -------------------------------------------------------------------------- */

function StepWhyStartupsFail() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" />
          <CardTitle className="text-xl">Why Most Startups Fail</CardTitle>
        </div>
        <CardDescription>
          The numbers are stark, but the causes are preventable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard value="42%" label="fail because they build something nobody wants" />
          <StatCard value="29%" label="simply run out of cash" />
          <StatCard value="70%" label="of failed startup CEOs had information-seeking deficits" />
          <StatCard value="66%" label="had customer service orientation deficits" />
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-medium text-primary">The good news?</p>
          <p className="mt-1 text-muted-foreground">
            These are preventable &mdash; if you test your assumptions before
            committing resources.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 2 — The Scientific Approach                                          */
/* -------------------------------------------------------------------------- */

function StepScientificApproach() {
  const steps = [
    { number: 1, text: "Start with a theory" },
    { number: 2, text: "State hypotheses explicitly" },
    { number: 3, text: "Design experiments to validate" },
    { number: 4, text: "Refine and retest" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FlaskConical className="size-5 text-primary" />
          <CardTitle className="text-xl">The Scientific Approach</CardTitle>
        </div>
        <CardDescription>
          Randomised controlled trials across Milan, Turin, and London proved
          that founders trained in hypothesis-testing outperformed their peers
          consistently.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">The four steps:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <div
                key={s.number}
                className="flex items-start gap-3 rounded-lg border bg-background p-3"
              >
                <Badge variant="secondary" className="mt-0.5 shrink-0">
                  {s.number}
                </Badge>
                <p className="text-sm">{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="text-muted-foreground">
            As researchers, you already think in hypotheses &mdash; SpinUp helps
            you redirect that skill from the lab to the market.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 3 — Common Traps to Avoid                                            */
/* -------------------------------------------------------------------------- */

function StepCommonTraps() {
  const traps = [
    {
      trap: "Writing 50-page business plans",
      why: "Static, obsolete before finished, delays customer contact",
    },
    {
      trap: "Perfecting the technology",
      why: "Builds features nobody asked for",
    },
    {
      trap: "Premature hiring/scaling",
      why: "20\u201340% increased failure rate in first 12 months",
    },
    {
      trap: "Endless networking events",
      why: "Substitutes activity for validated learning",
    },
    {
      trap: "Obsessing over IP before customers",
      why: "Protection without market validation is wasted effort",
    },
    {
      trap: "Elaborate financial models pre-revenue",
      why: "Projections without customer data are fiction",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-amber-500" />
          <CardTitle className="text-xl">Common Traps to Avoid</CardTitle>
        </div>
        <CardDescription>
          Six red herrings that feel productive but waste time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {traps.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border bg-background p-3"
            >
              <Badge
                variant="destructive"
                className="mt-0.5 shrink-0 tabular-nums"
              >
                {i + 1}
              </Badge>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.trap}</p>
                <p className="text-sm text-muted-foreground">{item.why}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 4 — How SpinUp Works                                                 */
/* -------------------------------------------------------------------------- */

function StepHowSpinUpWorks() {
  const phases = [
    { name: "Validate", description: "Test your core assumptions with real customers" },
    { name: "Build Minimum", description: "Create the smallest thing that delivers value" },
    { name: "Sell & Iterate", description: "Get paying customers and refine your offering" },
  ];

  const weeklyActions = [
    "Prompt a specific action",
    "Provide the right tool",
    "Capture your output",
    "Prompt reflection",
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-primary" />
          <CardTitle className="text-xl">How SpinUp Works</CardTitle>
        </div>
        <CardDescription>
          Three phases, guided weekly actions, real-world outcomes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">Three phases:</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {phases.map((phase, i) => (
              <div
                key={phase.name}
                className="flex flex-1 items-start gap-3 rounded-lg border bg-background p-3"
              >
                <Badge variant="secondary" className="mt-0.5 shrink-0">
                  {i + 1}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{phase.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {phase.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Each week, SpinUp will:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {weeklyActions.map((action, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border bg-background p-3"
              >
                <Badge variant="outline" className="shrink-0 tabular-nums">
                  {i + 1}
                </Badge>
                <p className="text-sm">{action}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="text-muted-foreground">
            Every screen ends with a specific action you take in the real world.
          </p>
          <p className="text-muted-foreground">
            You&apos;ll move freely between phases, but we&apos;ll track your
            progress.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
