import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ImageIcon, Loader2, Rocket, Save, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Panel, fmtMoney } from "@/components/cyber";

export default function AiCreator() {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);

  // New campaign generator
  const [goal, setGoal] = useState("");
  const [product, setProduct] = useState("");
  const [budget, setBudget] = useState("");
  const [plan, setPlan] = useState<any | null>(null);

  const planMut = trpc.ai.analyzeForNewCampaign.useMutation({
    onSuccess: (r) => {
      setPlan(r);
      toast.success("AI ออกแบบแคมเปญใหม่แล้ว");
    },
    onError: (e) => toast.error(e.message),
  });

  // Image generation (free-form prompt + optional product reference)
  const [prompt, setPrompt] = useState("");
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [genUrl, setGenUrl] = useState<string | null>(null);

  const upload = trpc.ai.uploadProductImage.useMutation({
    onSuccess: (r) => {
      setRefUrl(r.url);
      toast.success("อัปโหลดรูปอ้างอิงแล้ว");
    },
    onError: (e) => toast.error(e.message),
  });

  const genImage = trpc.ai.generateAdImage.useMutation({
    onSuccess: (r) => {
      setGenUrl(r.url);
      toast.success("สร้างภาพสำเร็จ");
    },
    onError: (e) => toast.error(e.message),
  });

  const saveDraft = trpc.ai.saveDraft.useMutation({
    onSuccess: () => {
      toast.success("บันทึก Draft แล้ว");
      utils.ai.listDrafts.invalidate();
    },
  });

  const onFile = (f: File) => {
    if (f.size > 8 * 1024 * 1024) return toast.error("ไฟล์ใหญ่เกิน 8MB");
    const reader = new FileReader();
    reader.onload = () => upload.mutate({ dataUrl: reader.result as string, fileName: f.name });
    reader.readAsDataURL(f);
  };

  return (
    <div>
      <PageHeader
        title="AI Creator"
        subtitle="ให้ AI ออกแบบแคมเปญใหม่ทั้งหมด และสร้างภาพโฆษณาจากข้อความหรือรูปสินค้าอ้างอิง"
        icon={<ImageIcon className="h-5 w-5" />}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Campaign generator */}
        <div className="space-y-5">
          <Panel glow="blue" className="space-y-4">
            <h3 className="font-display text-glow-blue flex items-center gap-2">
              <Rocket className="h-4 w-4" /> ออกแบบแคมเปญใหม่
            </h3>
            <div className="space-y-2">
              <Label className="text-xs">เป้าหมาย</Label>
              <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="เช่น เพิ่มยอดขายออนไลน์" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">สินค้า/บริการ</Label>
              <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="เช่น รองเท้าวิ่ง" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">งบต่อวัน (บาท, ไม่บังคับ)</Label>
              <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="500" />
            </div>
            <Button
              className="w-full glow-pink"
              disabled={!goal || !product || planMut.isPending}
              onClick={() => planMut.mutate({ goal, product, budget: budget ? Number(budget) : undefined })}
            >
              {planMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              สร้างแผนแคมเปญ
            </Button>
          </Panel>

          {plan && (
            <Panel glow="pink" className="space-y-2 text-sm">
              <h3 className="font-display text-glow-pink mb-2">แผนแคมเปญจาก AI</h3>
              <Row label="Objective" value={plan.objective} />
              <Row label="กลุ่มเป้าหมาย" value={plan.audience} />
              <Row label="Placements" value={plan.placements} />
              <Row label="งบต่อวัน" value={fmtMoney(plan.dailyBudget)} />
              <Row label="พาดหัว" value={plan.headline} />
              <Row label="เนื้อหา" value={plan.body} />
              <Row label="CTA" value={plan.cta} />
              <div className="rounded-lg border border-border/50 p-2 bg-background/40">
                <p className="text-xs text-muted-foreground">Image Prompt</p>
                <p className="text-xs font-mono text-accent">{plan.imagePrompt}</p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 border-accent/50 bg-accent/5" disabled={genImage.isPending}
                  onClick={() => { setPrompt(plan.imagePrompt); genImage.mutate({ prompt: plan.imagePrompt, referenceImageUrl: refUrl ?? undefined }); }}>
                  {genImage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} สร้างภาพ
                </Button>
                <Button className="flex-1 glow-pink" disabled={saveDraft.isPending}
                  onClick={() => saveDraft.mutate({
                    mode: "new_campaign", headline: plan.headline, body: plan.body, cta: plan.cta,
                    imagePrompt: plan.imagePrompt, imageUrl: genUrl ?? undefined,
                    audienceJson: { audience: plan.audience, placements: plan.placements, objective: plan.objective },
                    budgetJson: { dailyBudget: plan.dailyBudget },
                  })}>
                  <Save className="h-4 w-4" /> บันทึก Draft
                </Button>
              </div>
            </Panel>
          )}
        </div>

        {/* Image studio */}
        <Panel glow="pink" className="space-y-4">
          <h3 className="font-display text-glow-pink flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> สตูดิโอสร้างภาพโฆษณา
          </h3>
          <div className="space-y-2">
            <Label className="text-xs">คำอธิบายภาพ (Prompt)</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="เช่น A vibrant product shot of sneakers on neon background, cyberpunk style"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <Button variant="outline" className="border-accent/50 bg-accent/5" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} อัปโหลดรูปสินค้า
            </Button>
            {refUrl && <img src={refUrl} alt="ref" className="h-12 w-12 rounded object-cover border border-accent/40" />}
          </div>

          <Button className="w-full glow-pink" disabled={!prompt || genImage.isPending}
            onClick={() => genImage.mutate({ prompt, referenceImageUrl: refUrl ?? undefined })}>
            {genImage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} สร้างภาพโฆษณา
          </Button>

          {genUrl ? (
            <div className="space-y-2">
              <img src={genUrl} alt="generated" className="rounded-lg border border-primary/40 w-full glow-pink" />
              <a href={genUrl} target="_blank" rel="noreferrer" className="text-xs text-accent underline">เปิดภาพขนาดเต็ม</a>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/50 py-12 text-center text-sm text-muted-foreground">
              ภาพที่สร้างจะปรากฏที่นี่
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
