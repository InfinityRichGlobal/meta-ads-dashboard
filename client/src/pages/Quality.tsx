import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Gauge } from "lucide-react";
import { AiPanel } from "@/components/AiPanel";
import { DatePreset, DatePresetSelect, Loading, PageHeader, Panel, TokenError, fmtMoney, fmtInt } from "@/components/cyber";

function scoreColor(s: number) {
  if (s >= 70) return "text-emerald-400";
  if (s >= 40) return "text-amber-400";
  return "text-rose-400";
}
function scoreRing(s: number) {
  if (s >= 70) return "rgba(52,211,153,0.8)";
  if (s >= 40) return "rgba(251,191,36,0.8)";
  return "rgba(244,63,94,0.8)";
}

export default function Quality() {
  const [preset, setPreset] = useState<DatePreset>("last_30d");
  const q = trpc.analytics.audienceQuality.useQuery({ datePreset: preset });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const ai = trpc.analytics.audienceQualityAiAnalyze.useMutation({
    onSuccess: (r) => setAnalysis(r.analysis),
    onError: (e) => toast.error(e.message),
  });

  const items: any[] = (q.data?.items as any[]) ?? [];

  return (
    <div>
      <PageHeader
        title="Audience Quality Analyzer"
        subtitle="ให้คะแนนคุณภาพกลุ่มเป้าหมายแต่ละ Ad Set จากอัตราการซื้อ สัดส่วนผู้ซื้อต่อผู้ทัก และ ROAS"
        icon={<Gauge className="h-5 w-5" />}
        actions={<DatePresetSelect value={preset} onChange={setPreset} />}
      />

      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <TokenError message={q.error.message} />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((it) => (
              <Panel key={it.adsetId} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{it.adsetName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{it.campaignName}</p>
                  </div>
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold"
                    style={{ boxShadow: `0 0 12px 2px ${scoreRing(it.qualityScore)}`, border: `2px solid ${scoreRing(it.qualityScore)}` }}
                  >
                    <span className={scoreColor(it.qualityScore)}>{it.qualityScore}</span>
                  </div>
                </div>
                {/* funnel */}
                <div className="space-y-1.5">
                  <FunnelBar label="คลิกลิงก์" value={it.funnel.linkClicks} max={it.funnel.linkClicks} color="#00e1ff" />
                  <FunnelBar label="ทักแชท" value={it.funnel.messages} max={it.funnel.linkClicks} color="#a855f7" />
                  <FunnelBar label="ซื้อ" value={it.funnel.purchases} max={it.funnel.linkClicks} color="#ff2a6d" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1">
                  <div><p className="text-muted-foreground">ใช้จ่าย</p><p className="font-mono">{fmtMoney(it.spend)}</p></div>
                  <div><p className="text-muted-foreground">ROAS</p><p className="font-mono">{it.roas}x</p></div>
                  <div><p className="text-muted-foreground">ผู้ซื้อ:ทัก</p><p className="font-mono">{it.buyerToChatterRatio ?? "—"}</p></div>
                </div>
              </Panel>
            ))}
            {items.length === 0 && <Panel className="col-span-full py-10 text-center text-muted-foreground">ไม่มีข้อมูล Ad Set</Panel>}
          </div>

          <AiPanel
            title="AI วิเคราะห์คุณภาพกลุ่มเป้าหมาย"
            content={analysis}
            loading={ai.isPending}
            onRun={() => ai.mutate({ items })}
            runLabel="วิเคราะห์คุณภาพ"
          />
        </div>
      )}
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 5 : 0) : 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-16 text-muted-foreground">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-background/60 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <span className="w-10 text-right font-mono">{value.toLocaleString()}</span>
    </div>
  );
}
