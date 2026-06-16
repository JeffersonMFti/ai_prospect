import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2, ChevronDown } from 'lucide-react';

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        onClick={(e) => e.stopPropagation()}
        className="w-full cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-2.5 pr-7
                   text-xs font-medium text-zinc-200 outline-none transition focus:border-violet-500/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#101014] text-zinc-100">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-brand-400', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

const tierMap: Record<string, { label: string; cls: string }> = {
  quente: { label: '🔥 quente', cls: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25' },
  morno: { label: '🌤️ morno', cls: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25' },
  frio: { label: '❄️ frio', cls: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25' },
};

export function TierBadge({ tier }: { tier: string | null }) {
  const t = tierMap[tier ?? 'frio'] ?? tierMap.frio;
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', t.cls)}>{t.label}</span>;
}

export function ScorePill({ score }: { score: number | null }) {
  const v = score ?? 0;
  const tone =
    v >= 80 ? 'from-rose-500/20 to-rose-500/5 text-rose-200 ring-rose-500/30'
    : v >= 55 ? 'from-amber-500/20 to-amber-500/5 text-amber-200 ring-amber-500/30'
    : 'from-sky-500/20 to-sky-500/5 text-sky-200 ring-sky-500/30';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-lg bg-gradient-to-br px-2.5 py-1 text-sm font-bold ring-1', tone)}>
      {score ?? '—'}
    </span>
  );
}

export function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'text-zinc-100',
  iconCls = 'text-brand-400 bg-brand-500/10',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  accent?: string;
  iconCls?: string;
}) {
  return (
    <div className="card card-hover animate-fade-in">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
        <span className={cn('rounded-lg p-2', iconCls)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn('mt-3 text-3xl font-extrabold tracking-tight', accent)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.06]">
        <Icon className="h-7 w-7 text-zinc-400" />
      </div>
      <h3 className="text-base font-semibold text-zinc-200">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: LucideIcon }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      {Icon && (
        <span className="rounded-xl bg-brand-500/10 p-2.5 ring-1 ring-brand-500/20">
          <Icon className="h-5 w-5 text-brand-400" />
        </span>
      )}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
      </div>
    </div>
  );
}
