import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { LayoutDashboard, RefreshCw, Loader2, AlertTriangle, KeyRound } from "lucide-react";
import { Link } from "wouter";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  DatePreset,
  DatePresetSelect,
  KpiCard,
  Loading,
  PageHeader,
  Panel,
  fmtMoney,
  fmtInt,
  fmtNum,
} from "@/components/cyber";

export default function Dashboard() {
  const [preset, setPreset] = useState<DatePreset>("last_7d");
  const overview = trpc.dashboard.overview.useQuery({ datePreset: preset });
  const trend = trpc.dashboard.trend.useQuery({ datePreset: preset });
  const utils = trpc.useUtils();

  const sync = trpc.dashboard.syncLive.useMutation({
    onSuccess: () => {
      toast.success("ซิงค์ข้อมูลล่าสุดแล้ว");
      utils.dashboard.overview.invalidate();
      utils.dashboard.trend.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const noToken =
    overview.error?.message?.includes("ยังไม่ได้") ||
    overview.error?.message?.toLowerCase().includes("token") ||
    overview.error?.message?.includes("เชื่อมต่อ");

  const cur = overview.data?.current;
  const ch = overview.data?.changes;

  return (
    <div>
      <PageHeader
        title="แดชบอร์ด"
        subtitle="ภาพรวมประสิทธิภาพโฆษณา Meta แบบเรียลไทม์ พร้อมเปรียบเทียบกับช่วงก่อนหน้า"
        icon={<LayoutDashboard className="h-5 w-5" />}
        actions={
          <>
            <DatePresetSelect value={preset} onChange={setPreset} />
            <Button
              onClick={() => sync.mutate({ datePreset: preset })}
              disabled={sync.isPending}
              className="glow-blue"
            >
              {sync.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              ซิงค์ข้อมูล
            </Button>
          </>
        }
      />

      {overview.isLoading ? (
        <Loading label="กำลังดึงข้อมูลจาก Meta..." />
      ) : overview.error ? (
        <Panel glow="pink" className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
          <p className="font-display text-glow-blue">{noToken ? "ยังไม่ได้เชื่อมต่อ Ad Account" : "ดึงข้อมูลไม่สำเร็จ"}</p>
          <p className="text-sm text-muted-foreground max-w-md">{overview.error.message}</p>
          {noToken && (
            <Link href="/settings">
              <Button className="glow-pink mt-2">
                <KeyRound className="h-4 w-4" /> ไปที่หน้าตั้งค่า Token
              </Button>
            </Link>
          )}
        </Panel>
      ) : cur ? (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="ใช้จ่าย" value={fmtMoney(cur.spend)} change={ch?.spend} accent="pink" />
            <KpiCard label="Impressions" value={fmtInt(cur.impressions)} change={ch?.impressions} accent="blue" />
            <KpiCard label="คลิก" value={fmtInt(cur.clicks)} change={ch?.clicks} accent="cyan" />
            <KpiCard label="CTR" value={`${fmtNum(cur.ctr)}%`} change={ch?.ctr} accent="blue" />
            <KpiCard label="CPA" value={fmtMoney(cur.cpa)} change={ch?.cpa} invertChange accent="pink" />
            <KpiCard label="ROAS" value={`${fmtNum(cur.roas)}x`} change={ch?.roas} accent="cyan" />
          </div>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Conversions" value={fmtInt(cur.conversions)} change={ch?.conversions} accent="purple" />
            <KpiCard label="CPC" value={fmtMoney(cur.cpc)} accent="blue" />
            <KpiCard label="CPM" value={fmtMoney(cur.cpm)} accent="cyan" />
            <KpiCard label="Reach" value={fmtInt(cur.reach)} accent="pink" />
          </div>

          {/* Trend charts */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <h3 className="font-display text-sm text-glow-pink mb-4">แนวโน้มการใช้จ่าย & Conversions</h3>
              <TrendArea data={trend.data?.series ?? []} loading={trend.isLoading} />
            </Panel>
            <Panel>
              <h3 className="font-display text-sm text-glow-blue mb-4">แนวโน้ม CTR & ROAS</h3>
              <TrendRate data={trend.data?.series ?? []} loading={trend.isLoading} />
            </Panel>
          </div>

          {overview.data?.syncedAt && (
            <p className="text-xs text-muted-foreground font-mono text-right">
              อัปเดตล่าสุด: {new Date(overview.data.syncedAt).toLocaleString("th-TH")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "rgba(20,16,40,0.95)",
  border: "1px solid rgba(120,100,200,0.4)",
  borderRadius: 8,
  fontSize: 12,
};

function TrendArea({ data, loading }: { data: any[]; loading: boolean }) {
  if (loading) return <Loading />;
  if (!data.length) return <p className="text-sm text-muted-foreground py-8 text-center">ไม่มีข้อมูล</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 4 }}>
        <defs>
          <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff3df0" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#ff3df0" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gConv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#36e0ff" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#36e0ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,100,200,0.12)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9b96c4" }} tickFormatter={(d) => d?.slice(5)} />
        <YAxis tick={{ fontSize: 10, fill: "#9b96c4" }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area type="monotone" dataKey="spend" name="ใช้จ่าย" stroke="#ff3df0" fill="url(#gSpend)" strokeWidth={2} />
        <Area type="monotone" dataKey="conversions" name="Conversions" stroke="#36e0ff" fill="url(#gConv)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TrendRate({ data, loading }: { data: any[]; loading: boolean }) {
  if (loading) return <Loading />;
  if (!data.length) return <p className="text-sm text-muted-foreground py-8 text-center">ไม่มีข้อมูล</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: -10, right: 8, top: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,100,200,0.12)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9b96c4" }} tickFormatter={(d) => d?.slice(5)} />
        <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#9b96c4" }} />
        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "#9b96c4" }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line yAxisId="l" type="monotone" dataKey="ctr" name="CTR %" stroke="#b388ff" strokeWidth={2} dot={false} />
        <Line yAxisId="r" type="monotone" dataKey="roas" name="ROAS" stroke="#ffd23f" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
