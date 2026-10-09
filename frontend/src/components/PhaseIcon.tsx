// Phase icons for the agent loop (DESIGN.md §5: icon + label, never color alone).
import {
  Brain,
  ClipboardList,
  Eye,
  FlaskConical,
  Gauge,
  Info,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

const PHASE_ICON: Record<string, typeof Eye> = {
  OBSERVE: Eye,
  REASON: Brain,
  PLAN: ClipboardList,
  'DRY-RUN': FlaskConical,
  DRY_RUN: FlaskConical,
  RISK: Gauge,
  TOOL: Wrench,
  'TOOL CALL': Wrench,
  VERIFY: ShieldCheck,
  REPLAN: RefreshCw,
};

export function PhaseIcon({ phase, className = 'w-3.5 h-3.5' }: { phase: string; className?: string }) {
  const Icon = PHASE_ICON[phase.toUpperCase()] || Info;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
