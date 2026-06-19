import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { riseItem } from '../lib/motion';

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
  return <span className={cn('chip', t.cls)}>{t.label}</span>;
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

/** Mini gráfico de linha decorativo/factual (recebe a série real). */
export function Sparkline({ data, className, stroke = 'rgb(167 139 250)' }: { data: number[]; className?: string; stroke?: string }) {
  if (data.length < 2) return null;
  const w = 72;
  const h = 24;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data
    .map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d - min) / span) * h}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('overflow-visible', className)} width={w} height={h} aria-hidden>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'text-zinc-100',
  iconCls = 'text-brand-400 bg-brand-500/10',
  trend,
  spark,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  accent?: string;
  iconCls?: string;
  trend?: number;
  spark?: number[];
}) {
  const up = trend != null && trend >= 0;
  return (
    <motion.div variants={riseItem} className="card card-hover group relative overflow-hidden">
      {/* brilho sutil no hover */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-500/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
        <span className={cn('rounded-lg p-2 ring-1 ring-inset ring-white/[0.06]', iconCls)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className={cn('text-3xl font-extrabold tracking-tight', accent)}>{value}</p>
        {spark && spark.length > 1 && <Sparkline data={spark} className="mb-1 shrink-0" />}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {trend != null && (
          <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', up ? 'text-emerald-400' : 'text-rose-400')}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? '+' : ''}{trend}%
          </span>
        )}
        {sub && <p className="text-xs text-zinc-500">{sub}</p>}
      </div>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="card flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="mb-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.06]">
        <Icon className="h-7 w-7 text-zinc-400" />
      </div>
      <h3 className="text-base font-semibold text-zinc-200">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3.5">
        {Icon && (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/10 ring-1 ring-inset ring-brand-500/20">
            <Icon className="h-5 w-5 text-brand-300" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
