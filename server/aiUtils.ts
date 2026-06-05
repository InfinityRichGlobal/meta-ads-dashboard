import { invokeLLM, listLLMModels } from "./_core/llm";

let _preferredModel: string | null = null;

/** Pick a capable model once and cache it. Prefers Claude/GPT family. */
export async function getPreferredModel(): Promise<string | undefined> {
  if (_preferredModel) return _preferredModel;
  try {
    const { data } = await listLLMModels();
    const ids = data.map((m) => m.id);
    const pick =
      ids.find((id) => id.startsWith("gpt-4.1")) ||
      ids.find((id) => id.startsWith("gpt-4o")) ||
      ids.find((id) => id.startsWith("claude")) ||
      ids.find((id) => id.startsWith("gpt")) ||
      ids[0];
    _preferredModel = pick ?? null;
    return pick;
  } catch {
    return undefined;
  }
}

/** Plain text completion in Thai by default. */
export async function aiText(system: string, user: string, maxTokens = 1500): Promise<string> {
  const model = await getPreferredModel();
  const res = await invokeLLM({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens,
  });
  const content = res.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((c: any) => (c.type === "text" ? c.text : "")).join("");
  }
  return "";
}

/** Structured JSON completion validated against a JSON schema. */
export async function aiJson<T = any>(
  system: string,
  user: string,
  schema: { name: string; schema: Record<string, unknown> },
  maxTokens = 2000,
): Promise<T> {
  const model = await getPreferredModel();
  const res = await invokeLLM({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens,
    response_format: {
      type: "json_schema",
      json_schema: { name: schema.name, schema: schema.schema, strict: true },
    },
  });
  const content = res.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((c: any) => (c.type === "text" ? c.text : "")).join("")
        : "{}";
  try {
    return JSON.parse(text) as T;
  } catch {
    // Attempt to extract JSON block
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("AI ไม่ได้คืนค่า JSON ที่ถูกต้อง");
  }
}

export const AI_SYSTEM_THAI =
  "คุณคือผู้เชี่ยวชาญด้านการตลาดโฆษณา Facebook/Meta Ads ระดับมืออาชีพ " +
  "วิเคราะห์ข้อมูลอย่างมีหลักการ ใช้ตัวเลขประกอบ และให้คำแนะนำที่นำไปปฏิบัติได้จริง " +
  "ตอบเป็นภาษาไทยเสมอ กระชับ ตรงประเด็น และใช้รูปแบบ Markdown ที่อ่านง่าย";
