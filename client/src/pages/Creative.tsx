import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Film, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AiPanel } from "@/components/AiPanel";
import { DatePreset, DatePresetSelect, Loading, PageHeader, Panel, TokenError, fmtMoney, fmtNum } from "@/components/cyber";

export default function Creative() {
  const [preset, setPreset] = useState<DatePreset>("last_30d");
  const q = trpc.analytics.creative.useQuery({ datePreset: preset });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const ai = trpc.analytics.creativeAiAnalyze.useMutation({
    onSuccess: (r) => setAnalysis(r.analysis),
    onError: (e) => toast.error(e.message),
  });

  const creatives: any[] = (q.data?.creatives as any[]) ?? [];

  return (
    <div>
      <PageHeader
        title="ประสิทธิภาพครีเอทีฟ"
        subtitle="เปรียบเทียบครีเอทีฟภาพและวิดีโอ พร้อมอัตราการดูวิดีโอ (retention) แต่ละช่วง"
        icon={<Film className="h-5 w-5" />}
        actions={<DatePresetSelect value={preset} onChange={setPreset} />}
      />

      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <TokenError message={q.error.message} />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {creatives.map((c) => (
              <Panel key={c.adId} glow={c.type === "video" ? "pink" : "blue"} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium text-sm">{c.adName}</span>
                  <Badge variant="outline" className={c.type === "video" ? "border-primary/50 text-primary" : "border-accent/50 text-accent"}>
                    {c.type === "video" ? <Film className="h-3 w-3 mr-1" /> : <ImageIcon className="h-3 w-3 mr-1" />}
                    {c.type}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Stat label="ใช้จ่าย" value={fmtMoney(c.spend)} />
                  <Stat label="CTR" value={`${fmtNum(c.ctr)}%`} />
                  <Stat label="ROAS" value={`${fmtNum(c.roas)}x`} />
                </div>
                {c.retention && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] text-muted-foreground font-display">Video Retention</p>
                    {(["p25", "p50", "p75", "p100"] as const).map((k) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="w-9 text-[11px] text-muted-foreground">{k.replace("p", "")}%</span>
                        <div className="flex-1 h-2 rounded-full bg-background/60 overflow-hidden">
                          <div className="h-full neon-divider rounded-full" style={{ width: `${c.retention[k]}%` }} />
                        </div>
                        <span className="w-10 text-right font-mono text-[11px] text-accent">{c.retention[k]}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            ))}
            {creatives.length === 0 && <Panel className="col-span-full py-10 text-center text-muted-foreground">ไม่มีข้อมูลครีเอทีฟ</Panel>}
          </div>

          <AiPanel
            title="AI วิเคราะห์ครีเอทีฟ"
            content={analysis}
            loading={ai.isPending}
            onRun={() => ai.mutate({ creatives })}
            runLabel="วิเคราะห์ครีเอทีฟ"
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/40 border border-border/30 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono text-xs mt-0.5">{value}</p>
    </div>
  );
}
