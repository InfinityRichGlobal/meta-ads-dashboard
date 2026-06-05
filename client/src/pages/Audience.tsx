import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Users } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AiPanel } from "@/components/AiPanel";
import { DatePreset, DatePresetSelect, Loading, PageHeader, Panel, TokenError, fmtMoney } from "@/components/cyber";

const PIE_COLORS = ["#ff2a6d", "#00e1ff", "#a855f7", "#22d3ee", "#f59e0b", "#34d399"];

export default function Audience() {
  const [preset, setPreset] = useState<DatePreset>("last_30d");
  const q = trpc.analytics.audience.useQuery({ datePreset: preset });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const ai = trpc.analytics.audienceAiAnalyze.useMutation({
    onSuccess: (r) => setAnalysis(r.analysis),
    onError: (e) => toast.error(e.message),
  });

  const ageGender: any[] = (q.data?.ageGender as any[]) ?? [];
  const device: any[] = (q.data?.device as any[]) ?? [];
  const region: any[] = (q.data?.region as any[]) ?? [];

  // Build age buckets grouped by gender for stacked bars
  const ageMap: Record<string, any> = {};
  for (const r of ageGender) {
    const a = (ageMap[r.age] ??= { age: r.age, male: 0, female: 0, unknown: 0 });
    const g = r.gender === "male" ? "male" : r.gender === "female" ? "female" : "unknown";
    a[g] += r.spend;
  }
  const ageData = Object.values(ageMap).sort((a: any, b: any) => String(a.age).localeCompare(String(b.age)));

  return (
    <div>
      <PageHeader
        title="ข้อมูลกลุ่มเป้าหมาย"
        subtitle="วิเคราะห์การใช้จ่ายและผลลัพธ์ตามอายุ เพศ อุปกรณ์ และภูมิภาค"
        icon={<Users className="h-5 w-5" />}
        actions={<DatePresetSelect value={preset} onChange={setPreset} />}
      />

      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <TokenError message={q.error.message} />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel glow="pink">
              <h3 className="font-display text-glow-pink mb-3 text-sm">ใช้จ่ายตามอายุ & เพศ</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ageData}>
                  <XAxis dataKey="age" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#0a0a1a", border: "1px solid #ff2a6d44", borderRadius: 8 }} />
                  <Bar dataKey="female" stackId="a" fill="#ff2a6d" name="หญิง" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="male" stackId="a" fill="#00e1ff" name="ชาย" />
                  <Bar dataKey="unknown" stackId="a" fill="#6b7280" name="ไม่ระบุ" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel glow="blue">
              <h3 className="font-display text-glow-blue mb-3 text-sm">ใช้จ่ายตามอุปกรณ์</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={device} dataKey="spend" nameKey="device" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.device}>
                    {device.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0a0a1a", border: "1px solid #00e1ff44", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <Panel>
            <h3 className="font-display text-sm text-glow-blue mb-3">ภูมิภาคยอดนิยม</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {region.slice(0, 12).map((r) => (
                <div key={r.region} className="flex items-center justify-between text-xs rounded-md bg-background/40 border border-border/30 px-3 py-2">
                  <span className="truncate">{r.region}</span>
                  <span className="font-mono text-accent">{fmtMoney(r.spend)}</span>
                </div>
              ))}
              {region.length === 0 && <p className="text-xs text-muted-foreground">ไม่มีข้อมูลภูมิภาค</p>}
            </div>
          </Panel>

          <AiPanel
            title="AI วิเคราะห์กลุ่มเป้าหมาย & แนะนำ targeting"
            content={analysis}
            loading={ai.isPending}
            onRun={() => ai.mutate({ ageGender, device, region })}
            runLabel="วิเคราะห์กลุ่มเป้าหมาย"
          />
        </div>
      )}
    </div>
  );
}
