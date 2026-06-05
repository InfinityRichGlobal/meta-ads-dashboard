import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading, PageHeader, Panel, fmtMoney, fmtNum } from "@/components/cyber";

export default function Breakeven() {
  const [name, setName] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [packingCost, setPackingCost] = useState("");

  const utils = trpc.useUtils();
  const list = trpc.breakeven.list.useQuery();

  const calcInput = useMemo(
    () => ({
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      shippingCost: Number(shippingCost) || 0,
      packingCost: Number(packingCost) || 0,
    }),
    [costPrice, sellingPrice, shippingCost, packingCost],
  );
  const preview = trpc.breakeven.calc.useQuery(calcInput, { enabled: calcInput.sellingPrice > 0 });

  const create = trpc.breakeven.create.useMutation({
    onSuccess: () => {
      toast.success("บันทึกสินค้าแล้ว");
      setName(""); setCostPrice(""); setSellingPrice(""); setShippingCost(""); setPackingCost("");
      utils.breakeven.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.breakeven.remove.useMutation({
    onSuccess: () => utils.breakeven.list.invalidate(),
  });

  return (
    <div>
      <PageHeader
        title="Break-even ROAS"
        subtitle="คำนวณต้นทุน กำไร และ ROAS จุดคุ้มทุน เพื่อกำหนดเป้าหมายแคมเปญที่ทำกำไร"
        icon={<Calculator className="h-5 w-5" />}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel glow="pink">
          <h3 className="font-display text-glow-pink text-sm mb-4">คำนวณสินค้า</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ชื่อสินค้า" value={name} onChange={setName} full />
            <Field label="ต้นทุน (฿)" value={costPrice} onChange={setCostPrice} type="number" />
            <Field label="ราคาขาย (฿)" value={sellingPrice} onChange={setSellingPrice} type="number" />
            <Field label="ค่าส่ง (฿)" value={shippingCost} onChange={setShippingCost} type="number" />
            <Field label="ค่าแพ็ค (฿)" value={packingCost} onChange={setPackingCost} type="number" />
          </div>
          <Button
            className="mt-4 glow-pink"
            disabled={!name || calcInput.sellingPrice <= 0 || create.isPending}
            onClick={() => create.mutate({ name, ...calcInput })}
          >
            <Plus className="h-4 w-4" /> บันทึกสินค้า
          </Button>
        </Panel>

        <Panel glow="blue">
          <h3 className="font-display text-glow-blue text-sm mb-4">ผลการคำนวณ</h3>
          {preview.data ? (
            <div className="grid grid-cols-2 gap-3">
              <Result label="ต้นทุนรวม" value={fmtMoney(preview.data.totalCost)} />
              <Result label="กำไรขั้นต้น" value={fmtMoney(preview.data.grossProfit)} accent />
              <Result label="อัตรากำไร" value={`${fmtNum(preview.data.profitMargin)}%`} />
              <Result label="CPA สูงสุด" value={fmtMoney(preview.data.maxCpa)} />
              <Result label="Break-even ROAS" value={preview.data.breakevenRoas ? `${preview.data.breakevenRoas}x` : "—"} accent />
              <Result label="ROAS กำไร 20%" value={preview.data.targetRoas20 ? `${preview.data.targetRoas20}x` : "—"} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">กรอกราคาขายเพื่อดูผลการคำนวณ</p>
          )}
        </Panel>
      </div>

      <Panel className="mt-5">
        <h3 className="font-display text-sm text-glow-blue mb-3">สินค้าที่บันทึกไว้</h3>
        {list.isLoading ? (
          <Loading />
        ) : !list.data || list.data.length === 0 ? (
          <p className="text-xs text-muted-foreground">ยังไม่มีสินค้า</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/40">
                  <th className="py-2">สินค้า</th>
                  <th>ต้นทุนรวม</th>
                  <th>กำไร</th>
                  <th>Break-even ROAS</th>
                  <th>CPA สูงสุด</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((it: any) => (
                  <tr key={it.id} className="border-b border-border/20">
                    <td className="py-2 font-medium">{it.name}</td>
                    <td className="font-mono">{fmtMoney(it.calc.totalCost)}</td>
                    <td className="font-mono text-emerald-400">{fmtMoney(it.calc.grossProfit)}</td>
                    <td className="font-mono text-accent">{it.calc.breakevenRoas ? `${it.calc.breakevenRoas}x` : "—"}</td>
                    <td className="font-mono">{fmtMoney(it.calc.maxCpa)}</td>
                    <td>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-rose-300" onClick={() => remove.mutate({ id: it.id })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", full }: any) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="mt-1 text-sm" />
    </div>
  );
}

function Result({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`font-display text-lg mt-0.5 ${accent ? "text-glow-pink" : "text-glow-blue"}`}>{value}</p>
    </div>
  );
}
