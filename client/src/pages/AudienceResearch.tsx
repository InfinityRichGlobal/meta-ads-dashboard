import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Search, Users, Target, Zap, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Panel, TokenError } from "@/components/cyber";
import { AiPanel } from "@/components/AiPanel";

type Interest = { id: string; name: string; audienceSizeLowerBound: number; audienceSizeUpperBound: number; path: string[]; topic: string };

const COUNTRY_OPTIONS = [
  { code: "TH", label: "ไทย" },
  { code: "SG", label: "สิงคโปร์" },
  { code: "MM", label: "เมียนมาร์" },
  { code: "MY", label: "มาเลเซีย" },
  { code: "VN", label: "เวียดนาม" },
  { code: "ID", label: "อินโดนีเซีย" },
  { code: "PH", label: "ฟิลิปปินส์" },
  { code: "KH", label: "กัมพูชา" },
  { code: "LA", label: "ลาว" },
];

function fmtAudience(low: number, high: number) {
  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : n.toString();
  if (!low && !high) return "N/A";
  return `${fmt(low)} – ${fmt(high)}`;
}

export default function AudienceResearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["TH"]);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(55);
  const [productDesc, setProductDesc] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [showEstimate, setShowEstimate] = useState(false);
  const [estimateResult, setEstimateResult] = useState<{ audienceSizeLowerBound: number; audienceSizeUpperBound: number } | null>(null);

  const searchQ = trpc.audience.searchInterests.useQuery(
    { query: debouncedQ },
    { enabled: debouncedQ.length >= 2 }
  );

  const estimateMut = trpc.audience.estimateSize.useMutation({
    onSuccess: (r) => { setEstimateResult(r); setShowEstimate(true); },
    onError: (e) => toast.error(e.message),
  });

  const aiMut = trpc.audience.aiSuggestTargeting.useMutation({
    onSuccess: (r) => setAiAnalysis(r.analysis),
    onError: (e) => toast.error(e.message),
  });

  const addInterest = (i: Interest) => {
    if (!selectedInterests.find((x) => x.id === i.id)) setSelectedInterests((prev) => [...prev, i]);
  };
  const removeInterest = (id: string) => setSelectedInterests((prev) => prev.filter((x) => x.id !== id));
  const toggleCountry = (code: string) =>
    setSelectedCountries((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);

  let searchTimeout: ReturnType<typeof setTimeout>;
  const handleSearch = (v: string) => {
    setSearchQuery(v);
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => setDebouncedQ(v), 500);
  };

  return (
    <div>
      <PageHeader
        title="Audience Research"
        subtitle="ค้นหาความสนใจ พฤติกรรม และประเมินขนาดกลุ่มเป้าหมาย Facebook"
        icon={<Users className="h-5 w-5" />}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Panel>
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" /> ค้นหาความสนใจ (Interests)
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder="พิมพ์ชื่อความสนใจ เช่น fitness, cooking, fashion..." className="pl-9" />
            </div>
            {searchQ.isLoading && debouncedQ && (
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> ค้นหา...
              </div>
            )}
            {searchQ.data && searchQ.data.length > 0 && (
              <div className="mt-3 space-y-1.5 max-h-64 overflow-auto">
                {searchQ.data.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 border border-border/40 bg-background/40 hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer" onClick={() => addInterest(item)}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      {item.path?.length > 0 && <p className="text-xs text-muted-foreground truncate">{item.path.join(" › ")}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono text-primary">{fmtAudience(item.audienceSizeLowerBound, item.audienceSizeUpperBound)}</p>
                      <p className="text-[10px] text-muted-foreground">คน</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {searchQ.data?.length === 0 && debouncedQ && !searchQ.isLoading && (
              <p className="mt-3 text-sm text-muted-foreground">ไม่พบความสนใจสำหรับ "{debouncedQ}"</p>
            )}
            {searchQ.error && <TokenError message={searchQ.error.message} />}
          </Panel>

          <Panel>
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> AI แนะนำ Targeting
            </h3>
            <div className="space-y-2">
              <Label className="text-xs">อธิบายสินค้า/บริการของคุณ</Label>
              <Textarea value={productDesc} onChange={(e) => setProductDesc(e.target.value)} placeholder="เช่น: ขายอาหารเสริมลดน้ำหนักสำหรับผู้หญิงวัย 25-45 ปี เน้นตลาดไทยและสิงคโปร์" className="min-h-[80px] resize-none text-sm" />
            </div>
            <AiPanel
              title=""
              content={aiAnalysis}
              loading={aiMut.isPending}
              onRun={() => {
                if (!productDesc.trim()) { toast.error("กรุณาอธิบายสินค้าก่อน"); return; }
                aiMut.mutate({ productDescription: productDesc, targetCountries: selectedCountries });
              }}
              runLabel="แนะนำ Targeting"
            />
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel>
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Targeting ที่เลือก
            </h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1.5 block">ประเทศ</Label>
                <div className="flex flex-wrap gap-1.5">
                  {COUNTRY_OPTIONS.map((c) => (
                    <button key={c.code} onClick={() => toggleCountry(c.code)} className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${selectedCountries.includes(c.code) ? "bg-primary/10 border-primary/40 text-primary" : "border-border/50 text-muted-foreground hover:border-primary/30"}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">อายุต่ำสุด</Label>
                  <Input type="number" min={18} max={65} value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">อายุสูงสุด</Label>
                  <Input type="number" min={18} max={65} value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} className="mt-1 h-8 text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">ความสนใจที่เลือก ({selectedInterests.length})</Label>
                {selectedInterests.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border/50 rounded-lg">ค้นหาและเลือกความสนใจจากด้านซ้าย</p>
                ) : (
                  <div className="space-y-1">
                    {selectedInterests.map((i) => (
                      <div key={i.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-primary/5 border border-primary/20 text-xs">
                        <span className="truncate font-medium">{i.name}</span>
                        <button onClick={() => removeInterest(i.id)} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/40">
              <Button className="w-full" disabled={estimateMut.isPending} onClick={() => estimateMut.mutate({ geoLocations: { countries: selectedCountries }, ageMin, ageMax, interests: selectedInterests.map((i) => ({ id: i.id, name: i.name })) })}>
                {estimateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                ประเมินขนาดกลุ่มเป้าหมาย
              </Button>
            </div>
            {showEstimate && estimateResult && (
              <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">ขนาดกลุ่มเป้าหมายโดยประมาณ</p>
                <p className="text-2xl font-bold text-primary">{fmtAudience(estimateResult.audienceSizeLowerBound, estimateResult.audienceSizeUpperBound)}</p>
                <p className="text-xs text-muted-foreground mt-1">คน</p>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
