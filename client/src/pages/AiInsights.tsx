import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { BrainCircuit, Sparkles, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AiPanel } from "@/components/AiPanel";
import { DatePreset, DatePresetSelect, PageHeader, Panel } from "@/components/cyber";

export default function AiInsights() {
  const [preset, setPreset] = useState<DatePreset>("last_7d");
  const [analysis, setAnalysis] = useState<string | null>(null);

  const recMut = trpc.ai.recommendations.useMutation({
    onSuccess: (r) => setAnalysis(r.analysis),
    onError: (e) => toast.error(e.message),
  });

  // Ad copy generator
  const [product, setProduct] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [variations, setVariations] = useState<any[]>([]);
  const copyMut = trpc.ai.generateAdCopy.useMutation({
    onSuccess: (r) => {
      setVariations(r.variations ?? []);
      toast.success(`สร้าง ${r.variations?.length ?? 0} แบบ`);
    },
    onError: (e) => toast.error(e.message),
  });

  const copyText = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("คัดลอกแล้ว");
  };

  return (
    <div>
      <PageHeader
        title="AI วิเคราะห์"
        subtitle="ให้ AI วิเคราะห์ภาพรวมบัญชีโฆษณา ระบุจุดแข็ง/จุดอ่อน และสร้างข้อความโฆษณาใหม่"
        icon={<BrainCircuit className="h-5 w-5" />}
        actions={<DatePresetSelect value={preset} onChange={setPreset} />}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <AiPanel
          title="วิเคราะห์ภาพรวมบัญชี"
          content={analysis}
          loading={recMut.isPending}
          onRun={() => recMut.mutate({ datePreset: preset })}
          runLabel="วิเคราะห์ตอนนี้"
        />

        <Panel glow="blue" className="space-y-4">
          <h3 className="font-display text-glow-blue flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> สร้างข้อความโฆษณา (Ad Copy)
          </h3>
          <div className="space-y-2">
            <Label className="text-xs">สินค้า/บริการ</Label>
            <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="เช่น ครีมบำรุงผิวหน้า" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">โทน</Label>
              <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="สนุก / หรูหรา" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">กลุ่มเป้าหมาย</Label>
              <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="ผู้หญิง 25-40" />
            </div>
          </div>
          <Button
            className="w-full glow-pink"
            disabled={!product || copyMut.isPending}
            onClick={() => copyMut.mutate({ product, tone: tone || undefined, audience: audience || undefined, count: 3 })}
          >
            {copyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            สร้างข้อความ 3 แบบ
          </Button>

          <div className="space-y-3">
            {variations.map((v, i) => (
              <div key={i} className="rounded-lg border border-border/50 p-3 bg-background/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-display text-accent">แบบที่ {i + 1}</span>
                  <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copyText(`${v.headline}\n\n${v.primaryText}\n\n[${v.cta}]`)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="font-medium text-sm text-glow-blue">{v.headline}</p>
                <p className="text-sm text-muted-foreground leading-snug">{v.primaryText}</p>
                <span className="inline-block text-xs rounded bg-primary/15 text-primary px-2 py-0.5">{v.cta}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
