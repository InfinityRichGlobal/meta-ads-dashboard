import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { ThailandMap } from "@/components/ThailandMap";
import { AiPanel } from "@/components/AiPanel";
import { DatePreset, DatePresetSelect, Loading, PageHeader, Panel, TokenError } from "@/components/cyber";

export default function Geo() {
  const [preset, setPreset] = useState<DatePreset>("last_30d");
  const geo = trpc.analytics.geo.useQuery({ datePreset: preset });
  const [analysis, setAnalysis] = useState<string | null>(null);

  const ai = trpc.analytics.geoAiAnalyze.useMutation({
    onSuccess: (r) => setAnalysis(r.analysis),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Geo Heatmap"
        subtitle="กระจายตัวของผลลัพธ์โฆษณาตามจังหวัดบนแผนที่ประเทศไทย"
        icon={<MapPin className="h-5 w-5" />}
        actions={<DatePresetSelect value={preset} onChange={setPreset} />}
      />

      {geo.isLoading ? (
        <Loading label="กำลังดึงข้อมูลภูมิภาค..." />
      ) : geo.error ? (
        <TokenError message={geo.error.message} />
      ) : (
        <div className="space-y-5">
          <Panel glow="blue">
            <ThailandMap data={(geo.data?.regions as any[]) ?? []} />
          </Panel>
          <AiPanel
            title="AI วิเคราะห์เชิงภูมิศาสตร์"
            content={analysis}
            loading={ai.isPending}
            onRun={() => ai.mutate({ regions: geo.data?.regions ?? [] })}
            runLabel="วิเคราะห์ภูมิภาค"
          />
        </div>
      )}
    </div>
  );
}
