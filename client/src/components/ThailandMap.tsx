import { useMemo, useState } from "react";
import thailand from "@svg-maps/thailand";

/**
 * Maps Meta "region" names (English, as returned by the Graph API) to the
 * @svg-maps/thailand location ids. Meta returns province names in English;
 * we normalise by lowercasing and stripping spaces for a tolerant match.
 */
function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

const ID_BY_NAME: Record<string, string> = {};
for (const loc of (thailand as any).locations) {
  ID_BY_NAME[normalize(loc.name)] = loc.id;
}
// A few common aliases between Meta region names and the svg map names.
const ALIASES: Record<string, string> = {
  bangkok: "bkk",
  bangkokmetropolis: "bkk",
  krungthepmahanakhon: "bkk",
  chonburi: ID_BY_NAME["chonburi"] ?? "",
  buriram: ID_BY_NAME["buriram"] ?? "",
  nakhonratchasima: ID_BY_NAME["nakhonratchasima"] ?? "",
};

export type RegionDatum = {
  region: string;
  spend: number;
  conversions: number;
  cpa: number;
  roas: number;
  ctr: number;
  impressions: number;
  clicks: number;
};

type Metric = "spend" | "conversions" | "roas" | "cpa";

const METRIC_LABEL: Record<Metric, string> = {
  spend: "ใช้จ่าย",
  conversions: "Conversions",
  roas: "ROAS",
  cpa: "CPA",
};

export function ThailandMap({ data }: { data: RegionDatum[] }) {
  const [metric, setMetric] = useState<Metric>("spend");
  const [hover, setHover] = useState<{ name: string; datum?: RegionDatum } | null>(null);

  const byId = useMemo(() => {
    const map: Record<string, RegionDatum> = {};
    for (const d of data) {
      const key = normalize(d.region);
      const id = ALIASES[key] || ID_BY_NAME[key];
      if (id) map[id] = d;
    }
    return map;
  }, [data]);

  const maxVal = useMemo(() => {
    let m = 0;
    for (const d of data) m = Math.max(m, d[metric] || 0);
    return m || 1;
  }, [data, metric]);

  const colorFor = (id: string) => {
    const d = byId[id];
    if (!d || !d[metric]) return "rgba(255,255,255,0.04)";
    const t = Math.min((d[metric] || 0) / maxVal, 1);
    // Interpolate electric-blue -> neon-pink along intensity.
    const r = Math.round(0 + t * 255);
    const g = Math.round(200 - t * 180);
    const b = Math.round(255 - t * 100);
    return `rgba(${r},${g},${b},${0.25 + t * 0.7})`;
  };

  const metrics: Metric[] = ["spend", "conversions", "roas", "cpa"];

  return (
    <div className="relative">
      <div className="flex gap-2 mb-3 flex-wrap">
        {metrics.map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`px-3 py-1 rounded-md text-xs font-display border transition-colors ${
              metric === m
                ? "border-primary text-primary bg-primary/10 glow-pink"
                : "border-border/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
        <div className="relative">
          <svg viewBox={(thailand as any).viewBox} className="w-full max-h-[560px]">
            {(thailand as any).locations.map((loc: any) => (
              <path
                key={loc.id}
                d={loc.path}
                fill={colorFor(loc.id)}
                stroke="rgba(0,225,255,0.25)"
                strokeWidth={0.5}
                className="transition-all duration-200 hover:stroke-[1.5] hover:stroke-[var(--neon-pink,#ff2a6d)] cursor-pointer"
                onMouseEnter={() => setHover({ name: loc.name, datum: byId[loc.id] })}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>
          {hover && (
            <div className="absolute top-2 right-2 cyber-panel rounded-lg p-3 text-xs min-w-[160px] pointer-events-none">
              <p className="font-display text-glow-blue mb-1">{hover.name}</p>
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

        {/* Ranked list */}
        <div className="w-full md:w-64 space-y-1.5 max-h-[520px] overflow-auto">
          <p className="text-xs font-display text-muted-foreground mb-1">อันดับตาม {METRIC_LABEL[metric]}</p>
          {[...data]
            .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
            .slice(0, 15)
            .map((d) => (
              <div key={d.region} className="flex items-center justify-between text-xs rounded px-2 py-1 bg-background/40 border border-border/30">
                <span className="truncate mr-2">{d.region}</span>
                <span className="font-mono text-accent">
                  {metric === "spend" || metric === "cpa" ? "฿" : ""}
                  {(d[metric] || 0).toLocaleString()}
                  {metric === "roas" ? "x" : ""}
                </span>
              </div>
            ))}
          {data.length === 0 && <p className="text-xs text-muted-foreground/60">ไม่มีข้อมูลภูมิภาค</p>}
        </div>
      </div>
    </div>
  );
}
