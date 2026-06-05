import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loader2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ---------- Date presets shared across pages ---------- */
export const DATE_PRESETS = [
  { value: "today", label: "วันนี้" },
  { value: "yesterday", label: "เมื่อวาน" },
  { value: "last_7d", label: "7 วันล่าสุด" },
  { value: "last_14d", label: "14 วันล่าสุด" },
  { value: "last_30d", label: "30 วันล่าสุด" },
  { value: "last_90d", label: "90 วันล่าสุด" },
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number]["value"];

export function DatePresetSelect({
  value,
  onChange,
}: {
  value: DatePreset;
  onChange: (v: DatePreset) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DatePreset)}>
      <SelectTrigger className="w-[160px] cyber-panel font-mono text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="cyber-panel">
        {DATE_PRESETS.map((p) => (
          <SelectItem key={p.value} value={p.value} className="font-mono text-xs">
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg cyber-panel glow-blue text-accent">
            {icon}
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-wide text-glow-pink">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

/* ---------- Cyber panel wrapper ---------- */
export function Panel({
  children,
  className,
  glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: "pink" | "blue" | "none";
}) {
  return (
    <div
      className={cn(
        "cyber-panel rounded-xl p-4 md:p-5",
        glow === "pink" && "glow-pink",
        glow === "blue" && "glow-blue",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------- KPI card ---------- */
export function KpiCard({
  label,
  value,
  change,
  invertChange,
  accent = "blue",
  suffix,
}: {
  label: string;
  value: string;
  change?: number | null;
  invertChange?: boolean; // for CPA/CPC where lower is better
  accent?: "pink" | "blue" | "cyan" | "purple";
  suffix?: string;
}) {
  const accentText =
    accent === "pink"
      ? "text-glow-pink"
      : accent === "cyan"
        ? "text-glow-cyan"
        : "text-glow-blue";

  const hasChange = change !== null && change !== undefined && isFinite(change);
  // good = positive, unless invertChange
  const positive = hasChange ? (invertChange ? change! < 0 : change! > 0) : false;
  const negative = hasChange ? (invertChange ? change! > 0 : change! < 0) : false;

  return (
    <Panel className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[2px] neon-divider" />
      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-display">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={cn("font-display text-2xl md:text-[26px] font-bold", accentText)}>{value}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      {hasChange && (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-xs font-mono rounded px-1.5 py-0.5",
            positive && "text-emerald-400 bg-emerald-400/10",
            negative && "text-rose-400 bg-rose-400/10",
            !positive && !negative && "text-muted-foreground bg-muted/30",
          )}
        >
          {positive ? <TrendingUp className="h-3 w-3" /> : negative ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {Math.abs(change!).toFixed(1)}%
          <span className="text-muted-foreground/70">vs ก่อนหน้า</span>
        </div>
      )}
    </Panel>
  );
}

/* ---------- Loading / empty states ---------- */
export function Loading({ label = "กำลังโหลด..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <span className="font-mono text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="font-display text-lg text-glow-blue">{title}</div>
      {description && <p className="text-sm text-muted-foreground max-w-md">{description}</p>}
      {action}
    </Panel>
  );
}

/* ---------- Signal light ---------- */
export function SignalDot({ signal }: { signal: "green" | "yellow" | "red" }) {
  const map = {
    green: { color: "bg-emerald-400", glow: "shadow-[0_0_8px_2px_rgba(52,211,153,0.7)]", label: "ดี" },
    yellow: { color: "bg-amber-400", glow: "shadow-[0_0_8px_2px_rgba(251,191,36,0.7)]", label: "เฝ้าระวัง" },
    red: { color: "bg-rose-500", glow: "shadow-[0_0_8px_2px_rgba(244,63,94,0.7)]", label: "แย่" },
  } as const;
  const s = map[signal];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", s.color, s.glow)} />
      <span className="text-xs text-muted-foreground">{s.label}</span>
    </span>
  );
}

/* ---------- Formatting helpers ---------- */
export const fmtMoney = (n: number, currency = "฿") =>
  `${currency}${(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
export const fmtInt = (n: number) => (n || 0).toLocaleString("th-TH");
export const fmtNum = (n: number, d = 2) => (n || 0).toLocaleString("th-TH", { maximumFractionDigits: d });

/* ---------- Shared token / fetch error panel ---------- */
export function TokenError({ message }: { message?: string }) {
  const isToken =
    message?.toLowerCase().includes("token") ||
    message?.includes("เชื่อมต่อ") ||
    message?.includes("Ad Account");
  return (
    <Panel glow="pink" className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="text-amber-400 text-3xl">⚠</div>
      <p className="font-display text-glow-blue">
        {isToken ? "ยังไม่ได้เชื่อมต่อ Ad Account" : "ดึงข้อมูลไม่สำเร็จ"}
      </p>
      <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      {isToken && (
        <a href="/settings" className="mt-2 inline-flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm text-primary glow-pink">
          ไปตั้งค่า Token
        </a>
      )}
    </Panel>
  );
}
