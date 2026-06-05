import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Zap, Plus, Trash2, Power, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Streamdown } from "streamdown";
import { Loading, PageHeader, Panel } from "@/components/cyber";

const CRON_PRESETS_SYNC = [
  { value: "0 0 */6 * * *", label: "ทุก 6 ชั่วโมง" },
  { value: "0 0 */12 * * *", label: "ทุก 12 ชั่วโมง" },
  { value: "0 0 8 * * *", label: "ทุกวัน 08:00" },
];

export default function Automation() {
  return (
    <div>
      <PageHeader
        title="ระบบอัตโนมัติ"
        subtitle="ตั้งค่ารายงานรายสัปดาห์ กฎหยุดโฆษณาอัตโนมัติ และการซิงก์ข้อมูลตามเวลา"
        icon={<Zap className="h-5 w-5" />}
      />

      <Tabs defaultValue="weekly">
        <TabsList className="cyber-panel mb-5">
          <TabsTrigger value="weekly">รายงานรายสัปดาห์</TabsTrigger>
          <TabsTrigger value="autopause">หยุดโฆษณาอัตโนมัติ</TabsTrigger>
          <TabsTrigger value="sync">ซิงก์ข้อมูล</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly"><WeeklyReport /></TabsContent>
        <TabsContent value="autopause"><AutoPause /></TabsContent>
        <TabsContent value="sync"><SyncSchedule /></TabsContent>
      </Tabs>

      <div className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-200/80">
        หมายเหตุ: งานตามเวลา (cron) จะเริ่มทำงานจริงหลังจาก <span className="font-semibold">เผยแพร่ (Publish)</span> เว็บแอปแล้วเท่านั้น ในโหมดพรีวิวสามารถกดเรียกใช้ด้วยตนเองได้
      </div>
    </div>
  );
}

function WeeklyReport() {
  const settings = trpc.automation.weeklyReportSettings.useQuery();
  const reports = trpc.automation.listWeeklyReports.useQuery();
  const utils = trpc.useUtils();
  const [cron, setCron] = useState("0 0 1 * * 1");

  const setSchedule = trpc.automation.setWeeklySchedule.useMutation({
    onSuccess: () => {
      toast.success("บันทึกการตั้งเวลาแล้ว");
      utils.automation.weeklyReportSettings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const generate = trpc.automation.generateWeeklyNow.useMutation({
    onSuccess: () => {
      toast.success("สร้างรายงานแล้ว");
      utils.automation.listWeeklyReports.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const enabled = settings.data?.enabled ?? false;

  return (
    <div className="space-y-5">
      <Panel glow="blue">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-glow-blue text-sm">รายงานสรุปอัตโนมัติทุกสัปดาห์</h3>
          <Switch
            checked={enabled}
            onCheckedChange={(c) => setSchedule.mutate({ enabled: c, cron })}
          />
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <Label className="text-[11px] text-muted-foreground">Cron (วินาที นาที ชม. วัน เดือน วันสัปดาห์)</Label>
            <Input value={cron} onChange={(e) => setCron(e.target.value)} className="mt-1 font-mono text-xs w-64" />
            <p className="text-[10px] text-muted-foreground mt-1">ค่าเริ่มต้น: ทุกวันจันทร์ 01:00 น.</p>
          </div>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending} className="glow-pink">
            <FileText className="h-4 w-4" /> {generate.isPending ? "กำลังสร้าง..." : "สร้างรายงานตอนนี้"}
          </Button>
        </div>
      </Panel>

      <Panel>
        <h3 className="font-display text-sm text-glow-blue mb-3">รายงานล่าสุด</h3>
        {reports.isLoading ? (
          <Loading />
        ) : !reports.data || reports.data.length === 0 ? (
          <p className="text-xs text-muted-foreground">ยังไม่มีรายงาน — กด "สร้างรายงานตอนนี้" เพื่อทดสอบ</p>
        ) : (
          <div className="space-y-3">
            {reports.data.map((r: any) => (
              <details key={r.id} className="rounded-lg border border-border/40 bg-background/40 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  รายงานสัปดาห์ {r.periodStart} – {r.periodEnd}
                </summary>
                <div className="prose-cyber mt-3"><Streamdown>{r.content}</Streamdown></div>
              </details>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function AutoPause() {
  const rules = trpc.automation.listAutoPauseRules.useQuery();
  const logs = trpc.automation.autoPauseLogs.useQuery();
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    name: "",
    metric: "cpa" as "cpa" | "roas" | "ctr" | "spend",
    operator: "gt" as "gt" | "lt" | "gte" | "lte",
    threshold: "",
    minSpend: "",
    level: "ad" as "ad" | "adset" | "campaign",
    cron: "0 0 */3 * * *",
  });

  const create = trpc.automation.createAutoPauseRule.useMutation({
    onSuccess: () => {
      toast.success("สร้างกฎแล้ว");
      setForm({ ...form, name: "", threshold: "", minSpend: "" });
      utils.automation.listAutoPauseRules.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const toggle = trpc.automation.toggleAutoPauseRule.useMutation({
    onSuccess: () => utils.automation.listAutoPauseRules.invalidate(),
  });
  const del = trpc.automation.deleteAutoPauseRule.useMutation({
    onSuccess: () => utils.automation.listAutoPauseRules.invalidate(),
  });

  const OPS: Record<string, string> = { gt: ">", lt: "<", gte: "≥", lte: "≤" };

  return (
    <div className="space-y-5">
      <Panel glow="pink">
        <h3 className="font-display text-glow-pink text-sm mb-4">สร้างกฎหยุดโฆษณาอัตโนมัติ</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-3">
            <Label className="text-[11px] text-muted-foreground">ชื่อกฎ</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">ระดับ</Label>
            <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v as any })}>
              <SelectTrigger className="mt-1 cyber-panel text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="cyber-panel">
                <SelectItem value="ad">โฆษณา</SelectItem>
                <SelectItem value="adset">ชุดโฆษณา</SelectItem>
                <SelectItem value="campaign">แคมเปญ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">เมตริก</Label>
            <Select value={form.metric} onValueChange={(v) => setForm({ ...form, metric: v as any })}>
              <SelectTrigger className="mt-1 cyber-panel text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="cyber-panel">
                <SelectItem value="cpa">CPA</SelectItem>
                <SelectItem value="roas">ROAS</SelectItem>
                <SelectItem value="ctr">CTR</SelectItem>
                <SelectItem value="spend">ใช้จ่าย</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">เงื่อนไข</Label>
            <Select value={form.operator} onValueChange={(v) => setForm({ ...form, operator: v as any })}>
              <SelectTrigger className="mt-1 cyber-panel text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="cyber-panel">
                <SelectItem value="gt">มากกว่า (&gt;)</SelectItem>
                <SelectItem value="gte">มากกว่าเท่ากับ (≥)</SelectItem>
                <SelectItem value="lt">น้อยกว่า (&lt;)</SelectItem>
                <SelectItem value="lte">น้อยกว่าเท่ากับ (≤)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">ค่าเกณฑ์</Label>
            <Input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">ใช้จ่ายขั้นต่ำ (฿)</Label>
            <Input type="number" value={form.minSpend} onChange={(e) => setForm({ ...form, minSpend: e.target.value })} className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">ตรวจสอบทุก</Label>
            <Select value={form.cron} onValueChange={(v) => setForm({ ...form, cron: v })}>
              <SelectTrigger className="mt-1 cyber-panel text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="cyber-panel">
                <SelectItem value="0 0 */3 * * *">ทุก 3 ชั่วโมง</SelectItem>
                <SelectItem value="0 0 */6 * * *">ทุก 6 ชั่วโมง</SelectItem>
                <SelectItem value="0 0 9 * * *">ทุกวัน 09:00</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          className="mt-4 glow-pink"
          disabled={!form.name || !form.threshold || create.isPending}
          onClick={() =>
            create.mutate({
              name: form.name,
              metric: form.metric,
              operator: form.operator,
              threshold: Number(form.threshold),
              minSpend: Number(form.minSpend) || 0,
              level: form.level,
              cron: form.cron,
              enabled: true,
            })
          }
        >
          <Plus className="h-4 w-4" /> สร้างกฎ
        </Button>
      </Panel>

      <Panel>
        <h3 className="font-display text-sm text-glow-blue mb-3">กฎที่ตั้งไว้</h3>
        {rules.isLoading ? (
          <Loading />
        ) : !rules.data || rules.data.length === 0 ? (
          <p className="text-xs text-muted-foreground">ยังไม่มีกฎ</p>
        ) : (
          <div className="space-y-2">
            {rules.data.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-xs rounded-md bg-background/40 border border-border/30 px-3 py-2">
                <div>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 text-muted-foreground font-mono">
                    {r.level} · {r.metric.toUpperCase()} {OPS[r.operator]} {r.threshold}
                    {Number(r.minSpend) > 0 ? ` · ใช้จ่าย ≥ ฿${r.minSpend}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => toggle.mutate({ id: r.id, enabled: !r.enabled })}>
                    <Power className={`h-3 w-3 ${r.enabled ? "text-emerald-400" : "text-muted-foreground"}`} />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-rose-300" onClick={() => del.mutate({ id: r.id })}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <h3 className="font-display text-sm text-glow-blue mb-3">บันทึกการทำงาน</h3>
        {logs.data && logs.data.length > 0 ? (
          <div className="space-y-1.5 max-h-64 overflow-auto">
            {logs.data.map((l: any) => (
              <div key={l.id} className="text-[11px] font-mono text-muted-foreground border-b border-border/20 py-1">
                <span className="text-accent">{new Date(l.createdAt).toLocaleString("th-TH")}</span> — {l.entityName} ({l.entityType}) หยุดเพราะ {l.reason}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">ยังไม่มีบันทึกการหยุดโฆษณา</p>
        )}
      </Panel>
    </div>
  );
}

function SyncSchedule() {
  const settings = trpc.automation.scheduleSettings.useQuery();
  const logs = trpc.automation.scheduleLogs.useQuery();
  const utils = trpc.useUtils();
  const [cron, setCron] = useState("0 0 */6 * * *");

  const setSchedule = trpc.automation.setSyncSchedule.useMutation({
    onSuccess: () => {
      toast.success("บันทึกการตั้งเวลาแล้ว");
      utils.automation.scheduleSettings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const enabled = settings.data?.enabled ?? false;

  return (
    <div className="space-y-5">
      <Panel glow="blue">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-glow-blue text-sm">ซิงก์ข้อมูลโฆษณาอัตโนมัติ</h3>
          <Switch checked={enabled} onCheckedChange={(c) => setSchedule.mutate({ enabled: c, cron })} />
        </div>
        <Label className="text-[11px] text-muted-foreground">ความถี่</Label>
        <Select value={cron} onValueChange={setCron}>
          <SelectTrigger className="mt-1 cyber-panel text-xs w-64"><SelectValue /></SelectTrigger>
          <SelectContent className="cyber-panel">
            {CRON_PRESETS_SYNC.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Panel>

      <Panel>
        <h3 className="font-display text-sm text-glow-blue mb-3 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> ประวัติการซิงก์
        </h3>
        {logs.data && logs.data.length > 0 ? (
          <div className="space-y-1.5 max-h-64 overflow-auto">
            {logs.data.map((l: any) => (
              <div key={l.id} className="text-[11px] font-mono text-muted-foreground border-b border-border/20 py-1">
                <span className="text-accent">{new Date(l.createdAt).toLocaleString("th-TH")}</span> — {l.status} {l.message ? `· ${l.message}` : ""}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">ยังไม่มีประวัติการซิงก์</p>
        )}
      </Panel>
    </div>
  );
}
