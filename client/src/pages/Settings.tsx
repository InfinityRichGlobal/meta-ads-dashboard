import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { KeyRound, CheckCircle2, XCircle, ShieldCheck, Trash2, Plug, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel, Loading } from "@/components/cyber";

export default function Settings() {
  const utils = trpc.useUtils();
  const active = trpc.token.getActive.useQuery();
  const history = trpc.token.history.useQuery();

  const [accessToken, setAccessToken] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [label, setLabel] = useState("");
  const [testResult, setTestResult] = useState<null | {
    ok: boolean;
    userName?: string;
    scopes?: string[];
    expiresAt?: number | null;
    error?: string;
  }>(null);

  const testMut = trpc.token.test.useMutation({
    onSuccess: (r) => {
      setTestResult(r as any);
      if (r.ok) toast.success("Token ใช้งานได้");
      else toast.error(r.error || "Token ไม่ถูกต้อง");
    },
    onError: (e) => {
      setTestResult({ ok: false, error: e.message });
      toast.error(e.message);
    },
  });

  const saveMut = trpc.token.save.useMutation({
    onSuccess: () => {
      toast.success("บันทึก Token สำเร็จ");
      setAccessToken("");
      setTestResult(null);
      utils.token.getActive.invalidate();
      utils.token.history.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeMut = trpc.token.revoke.useMutation({
    onSuccess: () => {
      toast.success("ยกเลิก Token แล้ว");
      utils.token.getActive.invalidate();
      utils.token.history.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const fmtDate = (d?: number | string | Date | null) =>
    d ? new Date(d).toLocaleString("th-TH") : "ไม่มีกำหนด";

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Token & การตั้งค่า"
        subtitle="เชื่อมต่อ Meta Marketing API ด้วย Access Token และ Ad Account ID เพื่อดึงข้อมูลโฆษณาจริง"
        icon={<KeyRound className="h-5 w-5" />}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Connect form */}
        <Panel glow="blue" className="space-y-4">
          <h2 className="font-display text-glow-blue flex items-center gap-2">
            <Plug className="h-4 w-4" /> เชื่อมต่อ Ad Account
          </h2>
          <div className="space-y-2">
            <Label className="text-xs">Access Token (Long-lived)</Label>
            <Input
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="EAAB..."
              className="font-mono text-xs"
              type="password"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Ad Account ID</Label>
            <Input
              value={adAccountId}
              onChange={(e) => setAdAccountId(e.target.value)}
              placeholder="act_1234567890 หรือ 1234567890"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">ชื่อกำกับ (ไม่บังคับ)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="เช่น ร้านหลัก" />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 border-accent/50 bg-accent/5"
              disabled={!accessToken || !adAccountId || testMut.isPending}
              onClick={() => testMut.mutate({ accessToken, adAccountId })}
            >
              {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              ทดสอบ Token
            </Button>
            <Button
              className="flex-1 glow-pink"
              disabled={!accessToken || !adAccountId || saveMut.isPending}
              onClick={() => saveMut.mutate({ accessToken, adAccountId, tokenLabel: label || undefined })}
            >
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              บันทึก
            </Button>
          </div>

          {testResult && (
            <div
              className={`rounded-lg p-3 text-sm ${
                testResult.ok ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
              }`}
            >
              {testResult.ok ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Token ใช้งานได้
                  </div>
                  <div className="text-xs opacity-90">บัญชี: {testResult.userName ?? "-"}</div>
                  <div className="text-xs opacity-90">หมดอายุ: {fmtDate(testResult.expiresAt)}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(testResult.scopes ?? []).map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px] border-accent/40">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" /> {testResult.error}
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            ต้องการสิทธิ์ <code className="text-accent">ads_read</code> และ{" "}
            <code className="text-accent">ads_management</code> — สร้าง Long-lived Token ได้จาก Graph API Explorer
            หรือ System User ใน Business Manager
          </p>
        </Panel>

        {/* Active token status */}
        <div className="space-y-5">
          <Panel glow="pink">
            <h2 className="font-display text-glow-pink mb-3">สถานะ Token ปัจจุบัน</h2>
            {active.isLoading ? (
              <Loading />
            ) : active.data ? (
              <div className="space-y-3 text-sm">
                <Row label="Ad Account" value={active.data.adAccountId} mono />
                <Row label="ชื่อกำกับ" value={active.data.tokenLabel || "-"} />
                <Row label="Token" value={active.data.maskedToken} mono />
                <Row
                  label="สถานะ"
                  value={
                    <Badge
                      className={
                        active.data.status === "active"
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-rose-500/15 text-rose-300"
                      }
                    >
                      {active.data.status}
                    </Badge>
                  }
                />
                <Row label="หมดอายุ" value={fmtDate(active.data.expiresAt as any)} />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Scopes</p>
                  <div className="flex flex-wrap gap-1">
                    {active.data.scopes.length ? (
                      active.data.scopes.map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px] border-accent/40">
                          {s}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-rose-500/40 text-rose-300 bg-rose-500/5"
                  onClick={() => revokeMut.mutate({ id: active.data!.id })}
                  disabled={revokeMut.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" /> ยกเลิก Token นี้
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                ยังไม่ได้เชื่อมต่อ Ad Account — กรอกข้อมูลด้านซ้ายเพื่อเริ่มต้น
              </p>
            )}
          </Panel>

          <Panel>
            <h2 className="font-display text-sm text-glow-blue mb-3">ประวัติการเชื่อมต่อ</h2>
            {history.isLoading ? (
              <Loading />
            ) : history.data && history.data.length ? (
              <div className="space-y-2 max-h-56 overflow-auto">
                {history.data.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between text-xs border-b border-border/40 pb-2">
                    <div>
                      <span className="text-accent font-mono">{h.action}</span>
                      <span className="text-muted-foreground ml-2">{h.detail}</span>
                    </div>
                    <span className="text-muted-foreground">{fmtDate(h.createdAt)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">ยังไม่มีประวัติ</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "text-sm"}>{value}</span>
    </div>
  );
}
