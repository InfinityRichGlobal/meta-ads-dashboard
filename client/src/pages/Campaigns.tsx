import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Table2, Pause, Play, AlertTriangle, KeyRound } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type Level = "campaigns" | "adsets" | "ads";

export default function Campaigns() {
  const [preset, setPreset] = useState<DatePreset>("last_7d");
  const [level, setLevel] = useState<Level>("campaigns");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const utils = trpc.useUtils();

  const campaigns = trpc.campaigns.list.useQuery({ datePreset: preset }, { enabled: level === "campaigns" });
  const adsets = trpc.campaigns.adsets.useQuery({ datePreset: preset }, { enabled: level === "adsets" });
  const ads = trpc.campaigns.ads.useQuery({ datePreset: preset }, { enabled: level === "ads" });

  const active = level === "campaigns" ? campaigns : level === "adsets" ? adsets : ads;
  const rows: any[] = (active.data as any[]) ?? [];

  const bulk = trpc.campaigns.bulkSetAdStatus.useMutation({
    onSuccess: (r) => {
      const okCount = r.results.filter((x) => x.ok).length;
      toast.success(`อัปเดตสำเร็จ ${okCount}/${r.results.length} รายการ`);
      setSelected(new Set());
      utils.campaigns.ads.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const single = trpc.campaigns.setAdStatus.useMutation({
    onSuccess: () => {
      toast.success("อัปเดตสถานะแล้ว");
      utils.campaigns.ads.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleSel = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const noToken =
    active.error?.message?.toLowerCase().includes("token") || active.error?.message?.includes("เชื่อมต่อ");

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return (
    <div>
      <PageHeader
        title="แคมเปญ & โฆษณา"
        subtitle="จัดการโครงสร้างโฆษณา 3 ระดับ พร้อมไฟสัญญาณประเมินสถานะและสั่งหยุด/เปิดแบบกลุ่ม"
        icon={<Table2 className="h-5 w-5" />}
        actions={<DatePresetSelect value={preset} onChange={setPreset} />}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <Tabs value={level} onValueChange={(v) => { setLevel(v as Level); setSelected(new Set()); }}>
          <TabsList className="cyber-panel">
            <TabsTrigger value="campaigns">แคมเปญ</TabsTrigger>
            <TabsTrigger value="adsets">Ad Sets</TabsTrigger>
            <TabsTrigger value="ads">โฆษณา</TabsTrigger>
          </TabsList>
        </Tabs>

        {level === "ads" && selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">เลือก {selected.size} รายการ</span>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400/40 text-amber-300 bg-amber-400/5"
              onClick={() => bulk.mutate({ adIds: selectedIds, status: "PAUSED" })}
              disabled={bulk.isPending}
            >
              <Pause className="h-3.5 w-3.5" /> หยุดที่เลือก
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-400/40 text-emerald-300 bg-emerald-400/5"
              onClick={() => bulk.mutate({ adIds: selectedIds, status: "ACTIVE" })}
              disabled={bulk.isPending}
            >
              <Play className="h-3.5 w-3.5" /> เปิดที่เลือก
            </Button>
          </div>
        )}
      </div>

      {active.isLoading ? (
        <Loading label="กำลังดึงข้อมูลจาก Meta..." />
      ) : active.error ? (
        <Panel glow="pink" className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
          <p className="font-display text-glow-blue">{noToken ? "ยังไม่ได้เชื่อมต่อ Ad Account" : "ดึงข้อมูลไม่สำเร็จ"}</p>
          <p className="text-sm text-muted-foreground max-w-md">{active.error.message}</p>
          {noToken && (
            <Link href="/settings">
              <Button className="glow-pink mt-2"><KeyRound className="h-4 w-4" /> ตั้งค่า Token</Button>
            </Link>
          )}
        </Panel>
      ) : rows.length === 0 ? (
        <Panel className="py-12 text-center text-muted-foreground">ไม่พบข้อมูลในช่วงเวลานี้</Panel>
      ) : (
        <Panel className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-xs uppercase text-muted-foreground font-display tracking-wider">
                  {level === "ads" && <th className="p-3 w-8"></th>}
                  <th className="p-3 text-left">ชื่อ</th>
                  <th className="p-3 text-left">สถานะ</th>
                  <th className="p-3 text-left">สัญญาณ</th>
                  <th className="p-3 text-right">ใช้จ่าย</th>
                  <th className="p-3 text-right">Impr.</th>
                  <th className="p-3 text-right">CTR</th>
                  <th className="p-3 text-right">CPA</th>
                  <th className="p-3 text-right">ROAS</th>
                  <th className="p-3 text-right">Conv.</th>
                  {level === "ads" && <th className="p-3 text-right">จัดการ</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const m = r.metrics ?? {};
                  const isActive = (r.status ?? r.effectiveStatus) === "ACTIVE";
                  return (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-accent/5 transition-colors">
                      {level === "ads" && (
                        <td className="p-3">
                          <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSel(r.id)} />
                        </td>
                      )}
                      <td className="p-3 max-w-[260px]">
                        <div className="flex items-center gap-2">
                          {r.thumbnailUrl && (
                            <img src={r.thumbnailUrl} alt="" className="h-9 w-9 rounded object-cover border border-border/50" />
                          )}
                          <span className="truncate">{r.name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={isActive ? "border-emerald-400/40 text-emerald-300" : "border-muted text-muted-foreground"}
                        >
                          {r.status ?? r.effectiveStatus}
                        </Badge>
                      </td>
                      <td className="p-3"><SignalDot signal={r.signal} /></td>
                      <td className="p-3 text-right font-mono">{fmtMoney(m.spend)}</td>
                      <td className="p-3 text-right font-mono">{fmtInt(m.impressions)}</td>
                      <td className="p-3 text-right font-mono">{fmtNum(m.ctr)}%</td>
                      <td className="p-3 text-right font-mono">{fmtMoney(m.cpa)}</td>
                      <td className="p-3 text-right font-mono">{fmtNum(m.roas)}x</td>
                      <td className="p-3 text-right font-mono">{fmtInt(m.conversions)}</td>
                      {level === "ads" && (
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
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
