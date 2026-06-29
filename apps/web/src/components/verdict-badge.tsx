import { AlertTriangle, Ban, CircleDot, Eye, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getVerdictPresentation,
  type ProductionVerdict,
} from "@/lib/verdict-presentation";

const ICONS = {
  incomplete: CircleDot,
  skip: Ban,
  monitor: Eye,
  risk: AlertTriangle,
  value: ShieldCheck,
  conviction: Sparkles,
};

export function VerdictBadge({
  verdict,
  rationale,
  className,
}: {
  verdict: ProductionVerdict;
  rationale?: string | null;
  className?: string;
}) {
  const presentation = getVerdictPresentation(verdict);
  const Icon = ICONS[presentation.icon];

  return (
    <section
      className={cn(
        "rounded-2xl border p-5",
        presentation.badgeClass,
        presentation.pulse && "motion-safe:animate-pulse",
        className,
      )}
      aria-label={`${presentation.label}: ${rationale || presentation.summary}`}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-current/20 bg-black/10">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-75">SabiScore verdict</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">{presentation.label}</h2>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 opacity-90">
        {rationale || presentation.summary}
      </p>
    </section>
  );
}
