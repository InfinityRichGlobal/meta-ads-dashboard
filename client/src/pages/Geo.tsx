import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { ThailandMap } from "@/components/ThailandMap";
import { SeaMap } from "@/components/SeaMap";
import { AiPanel } from "@/components/AiPanel";
import { DatePreset, DatePresetSelect, Loading, PageHeader, Panel, TokenError } from "@/components/cyber";

type MapView = "thailand" | "sea";

export default function Geo() {
  const [preset, setPreset] = useState<DatePreset>("last_30d");
  const [view, setView] = useState<MapView>("thailand");
  const geo = trpc.analytics.geo.useQuery({ datePreset: preset });
  const geoCountry = trpc.analytics.geoCountry.useQuery({ datePreset: preset }, { enabled: view === "sea" });
  const [analysis, setAnalysis] = useState<string | null>(null);

  const ai = trpc.analytics.geoAiAnalyze.useMutation({
    onSuccess: (r) => setAnalysis(r.analysis),
    onError: (e) => toast.error(e.message),
  });

  const isLoading = view === "thailand" ? geo.isLoading : geoCountry.isLoading;
  const error = view === "thailand" ? geo.error : geoCountry.error;

  return (
    <div>
      <PageHeader
        title="Geo Heatmap"
        subtitle="กระจายตัวของผลลัพธ์โฆษณาตามจังหวัดและประเทศ"
        icon={<MapPin className="h-5 w-5" />}
        actions={<DatePresetSelect value={preset} onChange={setPreset} />}
      />

      <div className="flex gap-2 mb-5">
        {(["thailand", "sea"] as MapView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              view === v
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
            }`}
          >
            {v === "thailand" ? "🇹🇭 แผนที่ไทย" : "🌏 Southeast Asia"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading label="กำลังดึงข้อมูลภูมิภาค..." />
      ) : error ? (
        <TokenError message={error.message} />
      ) : (
        <div className="space-y-5">
          <Panel glow="blue">
            {view === "thailand" ? (
              <ThailandMap data={(geo.data?.regions as any[]) ?? []} />
            ) : (
              <SeaMap data={(geoCountry.data?.countries as any[]) ?? []} />
            )}
          </Panel>
          <AiPanel
            title="AI วิเคราะห์เชิงภูมิศาสตร์"
            content={analysis}
            loading={ai.isPending}
            onRun={() =>
              ai.mutate({
                regions: view === "thailand"
                  ? (geo.data?.regions ?? [])
                  : (geoCountry.data?.countries ?? []),
              })
            }
            runLabel="วิเคราะห์ภูมิภาค"
          />
        </div>
      )}
    </div>
  );
}
