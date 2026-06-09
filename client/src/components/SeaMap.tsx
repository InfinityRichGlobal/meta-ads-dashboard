import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

const SEA_COUNTRIES = new Set([
  "THA", "MMR", "LAO", "KHM", "VNM", "MYS", "SGP", "IDN", "BRN", "PHL", "TLS",
]);

const COUNTRY_TH: Record<string, string> = {
  THA: "ไทย", MMR: "เมียนมาร์", LAO: "ลาว", KHM: "กัมพูชา", VNM: "เวียดนาม",
  MYS: "มาเลเซีย", SGP: "สิงคโปร์", IDN: "อินโดนีเซีย", BRN: "บรูไน",
  PHL: "ฟิลิปปินส์", TLS: "ติมอร์",
};

const NAME_TO_ISO3: Record<string, string> = {
  thailand: "THA", myanmar: "MMR", burma: "MMR",
  laos: "LAO", "lao people's democratic republic": "LAO",
  cambodia: "KHM", vietnam: "VNM", "viet nam": "VNM",
  malaysia: "MYS", singapore: "SGP", indonesia: "IDN",
  brunei: "BRN", philippines: "PHL", "timor-leste": "TLS",
};

export type CountryDatum = {
  country: string;
  spend: number;
  conversions: number;
  cpa: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
};

type Metric = "spend" | "conversions" | "roas" | "cpa";
const METRIC_LABEL: Record<Metric, string> = {
  spend: "ใช้จ่าย", conversions: "Conversions", roas: "ROAS", cpa: "CPA",
};

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export function SeaMap({ data }: { data: CountryDatum[] }) {
  const [metric, setMetric] = useState<Metric>("spend");
  const [hover, setHover] = useState<{ name: string; iso3?: string; datum?: CountryDatum } | null>(null);

  const byIso3 = useMemo(() => {
    const map: Record<string, CountryDatum> = {};
    for (const d of data) {
      const key = d.country.toLowerCase().trim();
      const iso3 = NAME_TO_ISO3[key];
      if (iso3) map[iso3] = d;
    }
    return map;
  }, [data]);

  const maxVal = useMemo(() => {
    let m = 0;
    for (const d of data) m = Math.max(m, d[metric] || 0);
    return m || 1;
  }, [data, metric]);

  const colorFor = (iso3: string | undefined, isSeA: boolean) => {
    if (!isSeA) return "oklch(0.96 0.004 255)";
    const d = iso3 ? byIso3[iso3] : undefined;
    if (!d || !d[metric]) return "oklch(0.88 0.01 264)";
    const t = Math.min((d[metric] || 0) / maxVal, 1);
    const l = 0.85 - t * 0.35;
    const c = 0.05 + t * 0.2;
    return `oklch(${l.toFixed(2)} ${c.toFixed(2)} 264)`;
  };

  const metrics: Metric[] = ["spend", "conversions", "roas", "cpa"];

  return (
    <div className="relative">
      <div className="flex gap-2 mb-3 flex-wrap">
        {metrics.map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
              metric === m
                ? "border-primary text-primary bg-primary/10"
                : "border-border/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
        <div className="relative rounded-xl overflow-hidden bg-muted/30 border border-border/40">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 800, center: [115, 10] }}
            style={{ width: "100%", height: "auto" }}
            viewBox="0 0 800 500"
          >
            <ZoomableGroup center={[115, 10]} zoom={1}>
              <Geographies geography={GEO_URL}>
                {({ geographies }: { geographies: any[] }) =>
                  geographies.map((geo: any) => {
                    const iso3 = geo.properties.ADM0_A3 ?? geo.id;
                    const isSeA = SEA_COUNTRIES.has(iso3);
                    const d = byIso3[iso3];
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={colorFor(iso3, isSeA)}
                        stroke={isSeA ? "oklch(0.6 0.1 264)" : "oklch(0.85 0.005 255)"}
                        strokeWidth={isSeA ? 0.8 : 0.3}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none", fill: isSeA ? "oklch(0.55 0.22 264)" : undefined },
                          pressed: { outline: "none" },
                        }}
                        className={isSeA ? "cursor-pointer transition-all" : ""}
                        onMouseEnter={() => isSeA && setHover({ name: COUNTRY_TH[iso3] ?? iso3, iso3, datum: d })}
                        onMouseLeave={() => setHover(null)}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {hover && (
            <div className="absolute top-3 left-3 cyber-panel rounded-lg p-3 text-xs min-w-[160px] pointer-events-none">
              <p className="font-semibold text-foreground mb-1">{hover.name}</p>
              {hover.datum ? (
                <div className="space-y-0.5 text-muted-foreground">
                  <p>ใช้จ่าย: <span className="text-foreground">฿{hover.datum.spend.toLocaleString()}</span></p>
                  <p>Conv: <span className="text-foreground">{hover.datum.conversions}</span></p>
                  <p>ROAS: <span className="text-foreground">{hover.datum.roas}x</span></p>
                  <p>CPA: <span className="text-foreground">฿{hover.datum.cpa}</span></p>
                </div>
              ) : (
                <p className="text-muted-foreground/60">ไม่มีข้อมูล</p>
              )}
            </div>
          )}
        </div>

        <div className="w-full md:w-64 space-y-1.5 max-h-[420px] overflow-auto">
          <p className="text-xs font-medium text-muted-foreground mb-2">อันดับตาม {METRIC_LABEL[metric]}</p>
          {[...data]
            .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
            .slice(0, 15)
            .map((d) => {
              const iso3 = NAME_TO_ISO3[d.country.toLowerCase().trim()];
              const label = COUNTRY_TH[iso3 ?? ""] || d.country;
              return (
                <div key={d.country} className="flex items-center justify-between text-xs rounded px-2 py-1.5 bg-background/60 border border-border/40">
                  <span className="truncate mr-2">{label}</span>
                  <span className="font-mono text-primary">
                    {metric === "spend" || metric === "cpa" ? "฿" : ""}
                    {(d[metric] || 0).toLocaleString()}
                    {metric === "roas" ? "x" : ""}
                  </span>
                </div>
              );
            })}
          {data.length === 0 && <p className="text-xs text-muted-foreground/60">ไม่มีข้อมูลประเทศ</p>}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[oklch(0.88_0.01_264)] border border-border/40" />
          <span>ไม่มีข้อมูล</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[oklch(0.7_0.12_264)]" />
          <span>ต่ำ</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-[oklch(0.5_0.22_264)]" />
          <span>สูง</span>
        </div>
      </div>
    </div>
  );
}
