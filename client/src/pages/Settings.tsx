import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  KeyRound, CheckCircle2, XCircle, ShieldCheck, Trash2, Plug, Loader2,
  Radio, RadioTower, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel, Loading } from "@/components/cyber";

export default function Settings() {
  const utils = trpc.useUtils();
  const active = trpc.token.getActive.useQuery();
  const allTokens = trpc.token.list.useQuery();
  const history = trpc.token.history.useQuery();

  const [showForm, setShowForm] = useState(false);
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
      toast.success("เพิ่ม Account สำเร็จ");
      setAccessToken(""); setAdAccountId(""); setLabel(""); setTestResult(null);
      setShowForm(false);
      utils.token.getActive.invalidate();
      utils.token.list.invalidate();
      utils.token.history.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const activateMut = trpc.token.activate.useMutation({
    onSuccess: () => {
      toast.success("เปลี่ยน Account สำเร็จ");
      utils.token.getActive.invalidate();
      utils.token.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeMut = trpc.token.revoke.useMutation({
    onSuccess: () => {
      toast.success("ลบ Account แล้ว");
      utils.token.getActive.invalidate();
      utils.token.list.invalidate();
      utils.token.history.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const fmtDate = (d?: number | string | Date | null) =>
    d ? new Date(d).toLocaleString("th-TH") : "ไม่มีกำหนด";

  const tokens = allTokens.data ?? [];
  const activeId = active.data?.id;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Token & การตั้งค่า"
        subtitle="จัดการ Meta Ad Accounts หลายบัญชี — สลับดูข้อมูลได้ทันที"
        icon={<KeyRound className="h-5 w-5" />}
      />

      <div className="space-y-5">
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <RadioTower className="h-4 w-4 text-primary" /> Ad Accounts ทั้งหมด
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> เพิ่ม Account
            </Button>
          </div>

          {allTokens.isLoading ? (
            <Loading />
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              ยังไม่มี Account — กด "เพิ่ม Account" เพื่อเริ่มต้น
            </p>
          ) : (
            <div className="space-y-2">
              {tokens.map((t: any) => {
                const isActive = t.id === activeId;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 border transition-colors ${
                      isActive ? "border-primary/40 bg-primary/5" : "border-border/50 bg-background/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.tokenLabel || t.adAccountId}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{t.adAccountId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-xs">ใช้งานอยู่</Badge>
                      ) : (
                        <Button
                          size="sm" variant="outline"
                          className="text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
                          disabled={activateMut.isPending}
                          onClick={() => activateMut.mutate({ id: t.id })}
                        >
                          <Radio className="h-3 w-3 mr-1" /> เปิดใช้งาน
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        disabled={revokeMut.isPending}
                        onClick={() => revokeMut.mutate({ id: t.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {showForm && (
          <Panel glow="blue" className="space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" /> เชื่อมต่อ Ad Account ใหม่
            </h2>
            <div className="space-y-2">
              <Label className="text-xs">Access Token (Long-lived)</Label>
              <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAB..." className="font-mono text-xs" type="password" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Ad Account ID</Label>
              <Input value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="act_1234567890 หรือ 1234567890" className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">ชื่อกำกับ (เช่น "Account สิงคโปร์")</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="เช่น ร้านหลัก, SG Account" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={!accessToken || !adAccountId || testMut.isPending} onClick={() => testMut.mutate({ accessToken, adAccountId })}>
                {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                ทดสอบ Token
              </Button>
              <Button className="flex-1" disabled={!accessToken || !adAccountId || saveMut.isPending} onClick={() => saveMut.mutate({ accessToken, adAccountId, tokenLabel: label || undefined })}>
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                บันทึก
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>ยกเลิก</Button>
            </div>
            {testResult && (
              <div className={`rounded-lg p-3 text-sm ${testResult.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
                {testResult.ok ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Token ใช้งานได้</div>
                    <div className="text-xs opacity-90">บัญชี: {testResult.userName ?? "-"}</div>
                    <div className="text-xs opacity-90">หมดอายุ: {fmtDate(testResult.expiresAt)}</div>
                    <div className="flex flex-wrap gap-1 mt-1">{(testResult.scopes ?? []).map((s) => (<Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>))}</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2"><XCircle className="h-4 w-4" /> {testResult.error}</div>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              ต้องการสิทธิ์ <code className="text-primary">ads_read</code> และ <code className="text-primary">ads_management</code>
            </p>
          </Panel>
        )}

        {active.data && (
          <Panel>
            <h2 className="font-semibold text-foreground mb-3">รายละเอียด Account ที่ใช้งานอยู่</h2>
            {active.isLoading ? <Loading /> : (
              <div className="space-y-3 text-sm">
                <Row label="Ad Account" value={active.data.adAccountId} mono />
                <Row label="ชื่อกำกับ" value={active.data.tokenLabel || "-"} />
                <Row label="Token" value={active.data.maskedToken} mono />
                <Row label="หมดอายุ" value={fmtDate(active.data.expiresAt as any)} />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Scopes</p>
                  <div className="flex flex-wrap gap-1">
                    {active.data.scopes.length ? active.data.scopes.map((s) => (<Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)) : <span className="text-xs text-muted-foreground">-</span>}
                  </div>
                </div>
              </div>
            )}
          </Panel>
        )}

        <Panel>
          <h2 className="font-semibold text-foreground mb-3 text-sm">ประวัติการเชื่อมต่อ</h2>
          {history.isLoading ? <Loading /> : history.data && history.data.length ? (
            <div className="space-y-2 max-h-56 overflow-auto">
              {history.data.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between text-xs border-b border-border/40 pb-2">
                  <div>
                    <span className="text-primary font-mono">{h.action}</span>
                    <span className="text-muted-foreground ml-2">{h.detail}</span>
                  </div>
                  <span className="text-muted-foreground">{fmtDate(h.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground py-2">ยังไม่มีประวัติ</p>}
        </Panel>
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
