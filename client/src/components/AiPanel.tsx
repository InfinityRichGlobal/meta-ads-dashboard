import { ReactNode } from "react";
import { Streamdown } from "streamdown";
import { BrainCircuit, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "./cyber";

export function AiPanel({
  title = "AI Insights",
  content,
  loading,
  onRun,
  runLabel = "ให้ AI วิเคราะห์",
  disabled,
  footer,
}: {
  title?: string;
  content?: string | null;
  loading?: boolean;
  onRun?: () => void;
  runLabel?: string;
  disabled?: boolean;
  footer?: ReactNode;
}) {
  return (
    <Panel glow="pink" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-primary" />
          <span className="font-display text-sm tracking-wide text-glow-pink">{title}</span>
        </div>
        {onRun && (
          <Button size="sm" onClick={onRun} disabled={loading || disabled} className="glow-pink h-8 text-xs">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {runLabel}
          </Button>
        )}
      </div>
      <div className="neon-divider" />
      {loading && !content ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> AI กำลังประมวลผล...
        </div>
      ) : content ? (
        <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-glow-blue prose-strong:text-primary prose-a:text-accent text-sm leading-relaxed">
          <Streamdown>{content}</Streamdown>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">
          กดปุ่มด้านบนเพื่อให้ AI วิเคราะห์ข้อมูลและให้คำแนะนำ
        </p>
      )}
      {footer}
    </Panel>
  );
}
