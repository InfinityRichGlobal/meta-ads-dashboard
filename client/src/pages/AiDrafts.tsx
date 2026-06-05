import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sparkles, ImageIcon, Loader2, Save, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePreset, DatePresetSelect, Loading, PageHeader, Panel } from "@/components/cyber";

export default function AiDrafts() {
  const [preset, setPreset] = useState<DatePreset>("last_30d");
  const ads = trpc.campaigns.ads.useQuery({ datePreset: preset });
  const utils = trpc.useUtils();

  const [adId, setAdId] = useState<string>("");
  const [concept, setConcept] = useState<any | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const analyze = trpc.ai.analyzeForNewCreative.useMutation({
    onSuccess: (r) => {
      setConcept(r);
      setImageUrl(null);
      toast.success("AI เสนอครีเอทีฟใหม่แล้ว");
    },
    onError: (e) => toast.error(e.message),
  });

  const genImage = trpc.ai.generateAdImage.useMutation({
    onSuccess: (r) => {
      setImageUrl(r.url);
      toast.success("สร้างภาพสำเร็จ");
    },
    onError: (e) => toast.error(e.message),
  });

  const saveDraft = trpc.ai.saveDraft.useMutation({
    onSuccess: () => {
      toast.success("บันทึก Draft แล้ว");
      utils.ai.listDrafts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const drafts = trpc.ai.listDrafts.useQuery();
  const delDraft = trpc.ai.deleteDraft.useMutation({
    onSuccess: () => {
      toast.success("ลบแล้ว");
      utils.ai.listDrafts.invalidate();
    },
  });

  const adList: any[] = (ads.data as any[]) ?? [];

  return (
    <div>
      <PageHeader
        title="AI Drafts"
        subtitle="เลือกโฆษณาเดิมให้ AI วิเคราะห์แล้วเสนอครีเอทีฟใหม่ พร้อมสร้างภาพโฆษณาด้วย AI และบันทึกเป็นแบบร่าง"
        icon={<Sparkles className="h-5 w-5" />}
        actions={<DatePresetSelect value={preset} onChange={setPreset} />}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Panel glow="blue" className="space-y-4">
            <h3 className="font-display text-glow-blue">เลือกโฆษณาต้นแบบ</h3>
            {ads.isLoading ? (
              <Loading />
            ) : ads.error ? (
              <p className="text-sm text-rose-300">{ads.error.message}</p>
            ) : (
              <Select value={adId} onValueChange={setAdId}>
                <SelectTrigger className="cyber-panel"><SelectValue placeholder="เลือกโฆษณา..." /></SelectTrigger>
                <SelectContent className="cyber-panel max-h-72">
                  {adList.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              className="w-full glow-pink"
              disabled={!adId || analyze.isPending}
              onClick={() => analyze.mutate({ adId, datePreset: preset })}
            >
              {analyze.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              วิเคราะห์ & เสนอครีเอทีฟใหม่
            </Button>
          </Panel>

          {concept && (
            <Panel glow="pink" className="space-y-3">
              <h3 className="font-display text-glow-pink">ครีเอทีฟใหม่จาก AI</h3>
              <Field label="คอนเซ็ปต์" value={concept.concept} />
              <Field label="พาดหัว" value={concept.headline} />
              <Field label="เนื้อหา" value={concept.body} />
              <Field label="CTA" value={concept.cta} />
              <div className="rounded-lg border border-border/50 p-3 bg-background/40">
                <p className="text-xs text-muted-foreground mb-1">Image Prompt (EN)</p>
                <p className="text-xs font-mono text-accent">{concept.imagePrompt}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-accent/50 bg-accent/5"
                  disabled={genImage.isPending}
                  onClick={() => genImage.mutate({ prompt: concept.imagePrompt })}
                >
                  {genImage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  สร้างภาพ
                </Button>
                <Button
                  className="flex-1 glow-pink"
                  disabled={saveDraft.isPending}
                  onClick={() =>
                    saveDraft.mutate({
                      mode: "new_creative",
                      adId,
                      adName: concept.adName ?? undefined,
                      headline: concept.headline,
                      body: concept.body,
                      cta: concept.cta,
                      imagePrompt: concept.imagePrompt,
                      imageUrl: imageUrl ?? undefined,
                    })
                  }
                >
                  <Save className="h-4 w-4" /> บันทึก Draft
                </Button>
              </div>
              {imageUrl && (
                <img src={imageUrl} alt="generated" className="rounded-lg border border-primary/40 w-full glow-pink" />
              )}
            </Panel>
          )}
        </div>

        {/* Saved drafts */}
        <Panel className="space-y-3">
          <h3 className="font-display text-sm text-glow-blue">แบบร่างที่บันทึกไว้</h3>
          {drafts.isLoading ? (
            <Loading />
          ) : drafts.data && drafts.data.length ? (
            <div className="space-y-3 max-h-[600px] overflow-auto">
              {drafts.data.map((d: any) => (
                <div key={d.id} className="rounded-lg border border-border/50 p-3 bg-background/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs rounded bg-primary/15 text-primary px-2 py-0.5">
                      {d.mode === "new_creative" ? "ครีเอทีฟใหม่" : "แคมเปญใหม่"}
                    </span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-rose-300" onClick={() => delDraft.mutate({ id: d.id })}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {d.imageUrl && <img src={d.imageUrl} alt="" className="rounded border border-border/50 w-full" />}
                  {d.headline && <p className="font-medium text-sm text-glow-blue">{d.headline}</p>}
                  {d.body && <p className="text-xs text-muted-foreground">{d.body}</p>}
                  {d.cta && <span className="inline-block text-xs rounded bg-accent/15 text-accent px-2 py-0.5">{d.cta}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีแบบร่าง</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
