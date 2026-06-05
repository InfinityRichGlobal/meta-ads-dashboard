import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FlaskConical, Trophy, Trash2, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Streamdown } from "streamdown";
import { DatePreset, DatePresetSelect, Loading, PageHeader, Panel, fmtMoney, fmtNum } from "@/components/cyber";

type VarType = "ad" | "adset" | "campaign";

export default function AbTest() {
  const [preset, setPreset] = useState<DatePreset>("last_30d");
  const [name, setName] = useState("");
  const [aType, setAType] = useState<VarType>("ad");
  const [aId, setAId] = useState("");
  const [aName, setAName] = useState("");
  const [bType, setBType] = useState<VarType>("ad");
  const [bId, setBId] = useState("");
  const [bName, setBName] = useState("");
  const [result, setResult] = useState<any>(null);

  const utils = trpc.useUtils();
  const history = trpc.abtest.history.useQuery();
  const compare = trpc.abtest.compare.useMutation({
    onSuccess: (r) => {
      setResult(r);
      utils.abtest.history.invalidate();
      toast.success("เปรียบเทียบเสร็จแล้ว");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.abtest.remove.useMutation({
    onSuccess: () => utils.abtest.history.invalidate(),
  });

  const m = result;

  function exportPdf() {
    if (!m) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("A/B Test Report", 14, 18);
    doc.setFontSize(11);
    doc.text(`Test: ${name || "-"}`, 14, 28);
    doc.text(`Date range: ${preset}`, 14, 35);
    doc.text(`Winner: ${m.winner === "tie" ? "Tie" : "Variant " + m.winner}`, 14, 42);
    doc.text(
      `z = ${m.stat.z} | p-value = ${m.stat.pValue} | ${m.stat.significant ? "Significant (p<0.05)" : "Not significant"}`,
      14,
      49,
    );
    const mk = (x: any) => [
      fmtMoney(x.spend),
      String(x.conversions),
      `${fmtNum(x.roas)}x`,
      fmtMoney(x.cpa),
      `${fmtNum(x.ctr)}%`,
      fmtMoney(x.cpc),
    ];
    autoTable(doc, {
      startY: 56,
      head: [["Variant", "Spend", "Conv.", "ROAS", "CPA", "CTR", "CPC"]],
      body: [
        [aName || "Variant A", ...mk(m.metricsA)],
        [bName || "Variant B", ...mk(m.metricsB)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [255, 45, 149] },
    });
    const afterTableY = (doc as any).lastAutoTable?.finalY ?? 90;
    const analysisLines = doc.splitTextToSize(
      (m.analysis || "").replace(/[#*`>_]/g, ""),
      180,
    );
    doc.setFontSize(10);
    doc.text("AI Analysis:", 14, afterTableY + 10);
    doc.setFontSize(8);
    doc.text(analysisLines, 14, afterTableY + 16);
    doc.save(`abtest-${name || "report"}.pdf`);
    toast.success("ส่งออก PDF แล้ว");
  }

  return (
    <div>
      <PageHeader
        title="A/B Test"
        subtitle="เปรียบเทียบโฆษณา ชุดโฆษณา หรือแคมเปญ 2 ตัว พร้อมนัยสำคัญทางสถิติและผู้ชนะจาก AI"
        icon={<FlaskConical className="h-5 w-5" />}
        actions={<DatePresetSelect value={preset} onChange={setPreset} />}
      />

      <div className="space-y-5">
        <Panel glow="blue">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อการทดสอบ" className="mb-4 max-w-md" />
          <div className="grid gap-4 md:grid-cols-2">
            <VariantForm color="pink" title="Variant A" type={aType} setType={setAType} id={aId} setId={setAId} vName={aName} setVName={setAName} />
            <VariantForm color="blue" title="Variant B" type={bType} setType={setBType} id={bId} setId={setBId} vName={bName} setVName={setBName} />
          </div>
          <Button
            className="mt-4 glow-pink"
            disabled={!name || !aId || !bId || compare.isPending}
            onClick={() =>
              compare.mutate({
                name,
                variantA: { type: aType, id: aId, name: aName || undefined },
                variantB: { type: bType, id: bId, name: bName || undefined },
                datePreset: preset,
                save: true,
              })
            }
          >
            {compare.isPending ? "กำลังเปรียบเทียบ..." : "เปรียบเทียบ"}
          </Button>
        </Panel>

        {compare.isPending && <Loading label="กำลังดึงข้อมูลและวิเคราะห์..." />}

        {m && (
          <Panel glow="pink">
            <div className="grid gap-4 md:grid-cols-2">
              <VariantResult title={aName || "Variant A"} metrics={m.metricsA} winner={m.winner === "A"} />
              <VariantResult title={bName || "Variant B"} metrics={m.metricsB} winner={m.winner === "B"} />
            </div>
            <div className="mt-4 rounded-lg border border-border/40 bg-background/40 p-3 text-sm">
              <p className="font-display text-glow-blue mb-1 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                ผู้ชนะ: {m.winner === "tie" ? "เสมอ" : `Variant ${m.winner}`}
              </p>
              <p className="text-xs text-muted-foreground">
                z = {m.stat.z} · p-value = {m.stat.pValue} ·{" "}
                <span className={m.stat.significant ? "text-emerald-400" : "text-amber-400"}>
                  {m.stat.significant ? "มีนัยสำคัญทางสถิติ (p < 0.05)" : "ยังไม่มีนัยสำคัญทางสถิติ"}
                </span>
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="outline" className="border-accent/50 text-glow-blue" onClick={exportPdf}>
                <FileDown className="h-3.5 w-3.5 mr-1" /> ส่งออก PDF
              </Button>
            </div>
            <div className="mt-3 prose-cyber">
              <Streamdown>{m.analysis}</Streamdown>
            </div>
          </Panel>
        )}

        {/* history */}
        <Panel>
          <h3 className="font-display text-sm text-glow-blue mb-3">ประวัติการทดสอบ</h3>
          {history.isLoading ? (
            <Loading />
          ) : !history.data || history.data.length === 0 ? (
            <p className="text-xs text-muted-foreground">ยังไม่มีประวัติการทดสอบ</p>
          ) : (
            <div className="space-y-2">
              {history.data.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between text-xs rounded-md bg-background/40 border border-border/30 px-3 py-2">
                  <div>
                    <span className="font-medium">{h.name}</span>
                    <span className="ml-2 text-muted-foreground">ผู้ชนะ: {h.winner}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-rose-300" onClick={() => remove.mutate({ id: h.id })}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function VariantForm(props: any) {
  const { color, title, type, setType, id, setId, vName, setVName } = props;
  return (
    <div className={`rounded-lg border p-3 ${color === "pink" ? "border-primary/40" : "border-accent/40"}`}>
      <p className={`font-display text-sm mb-2 ${color === "pink" ? "text-glow-pink" : "text-glow-blue"}`}>{title}</p>
      <Select value={type} onValueChange={(v) => setType(v as VarType)}>
        <SelectTrigger className="mb-2 cyber-panel text-xs"><SelectValue /></SelectTrigger>
        <SelectContent className="cyber-panel">
          <SelectItem value="ad">โฆษณา (Ad)</SelectItem>
          <SelectItem value="adset">ชุดโฆษณา (Ad Set)</SelectItem>
          <SelectItem value="campaign">แคมเปญ (Campaign)</SelectItem>
        </SelectContent>
      </Select>
      <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="ID" className="mb-2 font-mono text-xs" />
      <Input value={vName} onChange={(e) => setVName(e.target.value)} placeholder="ชื่อ (ไม่บังคับ)" className="text-xs" />
    </div>
  );
}

function VariantResult({ title, metrics, winner }: { title: string; metrics: any; winner: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${winner ? "border-amber-400/60 glow-pink" : "border-border/40"}`}>
      <p className="font-display text-sm mb-2 flex items-center gap-2">
        {winner && <Trophy className="h-4 w-4 text-amber-400" />}
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric label="ใช้จ่าย" value={fmtMoney(metrics.spend)} />
        <Metric label="Conversions" value={String(metrics.conversions)} />
        <Metric label="ROAS" value={`${fmtNum(metrics.roas)}x`} />
        <Metric label="CPA" value={fmtMoney(metrics.cpa)} />
        <Metric label="CTR" value={`${fmtNum(metrics.ctr)}%`} />
        <Metric label="CPC" value={fmtMoney(metrics.cpc)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-background/40 border border-border/30 px-2 py-1">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono">{value}</p>
    </div>
  );
}
