import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Clock, Save, Trash2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiPanel } from "@/components/AiPanel";
import { DatePreset, DatePresetSelect, Loading, PageHeader, Panel, TokenError, fmtMoney } from "@/components/cyber";

const DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export default function Dayparting() {
  const [preset, setPreset] = useState<DatePreset>("last_30d");
  const q = trpc.analytics.dayparting.useQuery({ datePreset: preset });
  const utils = trpc.useUtils();

  const [analysis, setAnalysis] = useState<string | null>(null);
  const ai = trpc.analytics.daypartingAiAnalyze.useMutation({
    onSuccess: (r) => setAnalysis(r.analysis),
    onError: (e) => toast.error(e.message),
  });

  // schedule editor: a 7x24 boolean grid of "active hours"
  const [scheduleName, setScheduleName] = useState("");
  const [active, setActive] = useState<boolean[][]>(() =>
    Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => true)),
  );
  const [paintMode, setPaintMode] = useState<boolean | null>(null);

  const grid: any[] = (q.data?.grid as any[]) ?? [];
  const maxCpa = useMemo(() => Math.max(1, ...grid.map((c) => c.cpa || 0)), [grid]);

  const cpaColor = (cpa: number, hasData: boolean) => {
    if (!hasData) return "rgba(255,255,255,0.03)";
    const t = Math.min(cpa / maxCpa, 1);
    // low CPA = green/cyan good, high CPA = red bad
    const r = Math.round(40 + t * 215);
    const g = Math.round(220 - t * 180);
    const b = Math.round(140 - t * 100);
    return `rgba(${r},${g},${b},${0.3 + t * 0.6})`;
  };

  const cellAt = (dow: number, hour: number) => grid.find((c) => c.dow === dow && c.hour === hour);

  const toggleCell = (d: number, h: number, paint?: boolean) => {
    setActive((prev) => {
      const next = prev.map((row) => [...row]);
      next[d][h] = paint !== undefined ? paint : !next[d][h];
      return next;
    });
  };

  const save = trpc.analytics.createDaypartingSchedule.useMutation({
    onSuccess: () => {
      toast.success("บันทึกตารางเวลาแล้ว");
      setScheduleName("");
      utils.analytics.listDaypartingSchedules.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const schedules = trpc.analytics.listDaypartingSchedules.useQuery();
  const del = trpc.analytics.deleteDaypartingSchedule.useMutation({
    onSuccess: () => {
      toast.success("ลบแล้ว");
      utils.analytics.listDaypartingSchedules.invalidate();
    },
  });
  const toggle = trpc.analytics.updateDaypartingSchedule.useMutation({
    onSuccess: () => utils.analytics.listDaypartingSchedules.invalidate(),
  });

  return (
    <div onMouseUp={() => setPaintMode(null)} onMouseLeave={() => setPaintMode(null)}>
      <PageHeader
        title="Dayparting"
        subtitle="แผนที่ความร้อน CPA ตามวันและชั่วโมง (7×24) พร้อมตัวแก้ไขตารางเวลาแสดงโฆษณา"
        icon={<Clock className="h-5 w-5" />}
        actions={<DatePresetSelect value={preset} onChange={setPreset} />}
      />

      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <TokenError message={q.error.message} />
      ) : (
        <div className="space-y-5">
          {/* CPA heatmap */}
          <Panel glow="pink">
            <h3 className="font-display text-glow-pink mb-3 text-sm">แผนที่ความร้อน CPA (7×24)</h3>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-[640px]">
                <div className="flex">
                  <div className="w-10" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">{h}</div>
                  ))}
                </div>
                {DAYS.map((day, d) => (
                  <div key={d} className="flex items-center">
                    <div className="w-10 text-xs text-muted-foreground font-display">{day}</div>
                    {Array.from({ length: 24 }, (_, h) => {
                      const c = cellAt(d, h);
                      const has = !!c && c.spend > 0;
                      return (
                        <div
                          key={h}
                          title={c ? `${day} ${h}:00 — CPA ฿${c.cpa} · ใช้จ่าย ฿${c.spend}` : ""}
                          className="flex-1 aspect-square m-[1px] rounded-sm"
                          style={{ background: cpaColor(c?.cpa ?? 0, has) }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
              <span>CPA ต่ำ</span>
              <div className="h-2 w-40 rounded-full" style={{ background: "linear-gradient(90deg,rgba(40,220,140,0.8),rgba(255,40,40,0.8))" }} />
              <span>CPA สูง</span>
            </div>
          </Panel>

          {/* Schedule editor */}
          <Panel glow="blue">
            <h3 className="font-display text-glow-blue mb-1 text-sm">ตัวแก้ไขตารางเวลาแสดงโฆษณา</h3>
            <p className="text-xs text-muted-foreground mb-3">คลิกหรือลากเพื่อเปิด/ปิดชั่วโมงที่ต้องการแสดงโฆษณา (เขียว = เปิด)</p>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-[640px] select-none">
                <div className="flex">
                  <div className="w-10" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">{h}</div>
                  ))}
                </div>
                {DAYS.map((day, d) => (
                  <div key={d} className="flex items-center">
                    <div className="w-10 text-xs text-muted-foreground font-display">{day}</div>
                    {Array.from({ length: 24 }, (_, h) => (
                      <div
                        key={h}
                        onMouseDown={() => { const np = !active[d][h]; setPaintMode(np); toggleCell(d, h, np); }}
                        onMouseEnter={() => { if (paintMode !== null) toggleCell(d, h, paintMode); }}
                        className={`flex-1 aspect-square m-[1px] rounded-sm cursor-pointer transition-colors ${
                          active[d][h] ? "bg-emerald-400/70 hover:bg-emerald-400" : "bg-background/60 hover:bg-muted/40"
                        }`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} placeholder="ชื่อตารางเวลา" className="max-w-xs" />
              <Button
                className="glow-pink"
                disabled={!scheduleName || save.isPending}
                onClick={() => save.mutate({ name: scheduleName, scheduleJson: { active } })}
              >
                <Save className="h-4 w-4" /> บันทึกตาราง
              </Button>
              <Button variant="outline" className="border-border/50" onClick={() => setActive(Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => true)))}>
                เปิดทั้งหมด
              </Button>
              <Button variant="outline" className="border-border/50" onClick={() => setActive(Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => false)))}>
                ปิดทั้งหมด
              </Button>
            </div>

            {/* saved schedules */}
            {schedules.data && schedules.data.length > 0 && (
              <div className="mt-4 space-y-2">
                {schedules.data.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between text-xs rounded-md bg-background/40 border border-border/30 px-3 py-2">
                    <span>{s.name}</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => toggle.mutate({ id: s.id, enabled: !s.enabled })}>
                        <Power className={`h-3 w-3 ${s.enabled ? "text-emerald-400" : "text-muted-foreground"}`} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-rose-300" onClick={() => del.mutate({ id: s.id })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <AiPanel
            title="AI แนะนำช่วงเวลาที่ควรลงโฆษณา"
            content={analysis}
            loading={ai.isPending}
            onRun={() => ai.mutate({ hourly: q.data?.hourly ?? [] })}
            runLabel="วิเคราะห์ช่วงเวลา"
          />
        </div>
      )}
    </div>
  );
}
