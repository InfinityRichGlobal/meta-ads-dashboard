import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Activity, AlertTriangle, KeyRound, Sparkles, Loader2, Pause, Play } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DatePreset,
  DatePresetSelect,
  Loading,
  PageHeader,
  Panel,
  SignalDot,
  fmtMoney,
  fmtInt,
  fmtNum,
} from "@/components/cyber";

const ACTION_STYLE: Record<string, { label: string; cls: string }> = {
  close: { label: "ควรปิด", cls: "border-rose-500/50 text-rose-300 bg-rose-500/10" },
  monitor: { label: "เฝ้าระวัง", cls: "border-amber-400/50 text-amber-300 bg-amber-400/10" },
  keep: { label: "คงไว้", cls: "border-sky-400/50 text-sky-300 bg-sky-400/10" },
  scale: { label: "เพิ่มงบ", cls: "border-emerald-400/50 text-emerald-300 bg-emerald-400/10" },
};

export default function AdsEvaluation() {
  const [preset, setPreset] = useState<DatePreset>("last_7d");
  const table = trpc.ads.table.useQuery({ datePreset: preset });
  const utils = trpc.useUtils();

  const [recs, setRecs] = useState<any[] | null>(null);
  const aiRec = trpc.ai.recommendToClose.useMutation({
    onSuccess: (r) => {
      setRecs(r.items ?? []);
      toast.success("AI วิเคราะห์เสร็จแล้ว");
    },
    onError: (e) => toast.error(e.message),
  });

  const single = trpc.campaigns.setAdStatus.useMutation({
    onSuccess: () => {
      toast.success("อัปเดตสถานะแล้ว");
      utils.ads.table.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const noToken =
    table.error?.message?.toLowerCase().includes("token") || table.error?.message?.includes("เชื่อมต่อ");

  const data = table.data;
  const recMap = new Map((recs ?? []).map((r) => [String(r.adId), r]));

  return (
    <div>
      <PageHeader
        title="ประเมินโฆษณา"
        subtitle="ตารางโฆษณาพร้อมไฟสัญญาณเทียบ benchmark ของบัญชี และให้ AI จัดกลุ่มโฆษณาที่ควรปิด/เพิ่มงบ"
        icon={<Activity className="h-5 w-5" />}
        actions={
          <>
            <DatePresetSelect value={preset} onChange={setPreset} />
            <Button
              className="glow-pink"
              disabled={aiRec.isPending || !data?.rows?.length}
              onClick={() => aiRec.mutate({ datePreset: preset })}
            >
              {aiRec.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI ประเมินทั้งหมด
            </Button>
          </>
        }
      />

      {table.isLoading ? (
        <Loading label="กำลังดึงข้อมูลจาก Meta..." />
      ) : table.error ? (
        <Panel glow="pink" className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
          <p className="font-display text-glow-blue">{noToken ? "ยังไม่ได้เชื่อมต่อ Ad Account" : "ดึงข้อมูลไม่สำเร็จ"}</p>
          <p className="text-sm text-muted-foreground max-w-md">{table.error.message}</p>
          {noToken && (
            <Link href="/settings"><Button className="glow-pink mt-2"><KeyRound className="h-4 w-4" /> ตั้งค่า Token</Button></Link>
          )}
        </Panel>
      ) : !data?.rows?.length ? (
        <Panel className="py-12 text-center text-muted-foreground">ไม่พบโฆษณาในช่วงเวลานี้</Panel>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Panel><p className="text-xs text-muted-foreground font-display">Benchmark CTR</p><p className="text-glow-blue font-display text-xl mt-1">{fmtNum(data.benchmark.ctr)}%</p></Panel>
            <Panel><p className="text-xs text-muted-foreground font-display">Target CPA</p><p className="text-glow-pink font-display text-xl mt-1">{fmtMoney(data.targetCpa)}</p></Panel>
            <Panel><p className="text-xs text-muted-foreground font-display">Min ROAS</p><p className="text-glow-cyan font-display text-xl mt-1">{fmtNum(data.minRoas)}x</p></Panel>
            <Panel><p className="text-xs text-muted-foreground font-display">จำนวนโฆษณา</p><p className="font-display text-xl mt-1">{data.rows.length}</p></Panel>
          </div>

          <Panel className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs uppercase text-muted-foreground font-display tracking-wider">
                    <th className="p-3 text-left">โฆษณา</th>
                    <th className="p-3 text-left">สัญญาณ</th>
                    <th className="p-3 text-right">ใช้จ่าย</th>
                    <th className="p-3 text-right">CTR</th>
                    <th className="p-3 text-right">CPA</th>
                    <th className="p-3 text-right">ROAS</th>
                    <th className="p-3 text-left">AI แนะนำ</th>
                    <th className="p-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r: any) => {
                    const rec = recMap.get(String(r.id));
                    const isActive = (r.status ?? r.effectiveStatus) === "ACTIVE";
                    return (
                      <tr key={r.id} className="border-b border-border/30 hover:bg-accent/5 align-top">
                        <td className="p-3 max-w-[240px]">
                          <div className="flex items-center gap-2">
                            {r.thumbnailUrl && <img src={r.thumbnailUrl} alt="" className="h-9 w-9 rounded object-cover border border-border/50" />}
                            <span className="truncate">{r.name}</span>
                          </div>
                        </td>
                        <td className="p-3"><SignalDot signal={r.signal} /></td>
                        <td className="p-3 text-right font-mono">{fmtMoney(r.metrics.spend)}</td>
                        <td className="p-3 text-right font-mono">{fmtNum(r.metrics.ctr)}%</td>
                        <td className="p-3 text-right font-mono">{fmtMoney(r.metrics.cpa)}</td>
                        <td className="p-3 text-right font-mono">{fmtNum(r.metrics.roas)}x</td>
                        <td className="p-3 max-w-[280px]">
                          {rec ? (
                            <div className="space-y-1">
                              <Badge variant="outline" className={ACTION_STYLE[rec.action]?.cls}>
                                {ACTION_STYLE[rec.action]?.label ?? rec.action} · {Math.round((rec.confidence ?? 0) * 100)}%
                              </Badge>
                              <p className="text-xs text-muted-foreground leading-snug">{rec.reason}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            disabled={single.isPending}
                            onClick={() => single.mutate({ adId: r.id, status: isActive ? "PAUSED" : "ACTIVE" })}
                          >
                            {isActive ? <Pause className="h-3.5 w-3.5 text-amber-300" /> : <Play className="h-3.5 w-3.5 text-emerald-300" />}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
