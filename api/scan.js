// POST /api/scan  { image: "data:image/jpeg;base64,..." }
// → { ok, name, type, color, thick }  (인식 못 한 항목은 null)
// Gemini 키는 Vercel 환경변수 GEMINI_API_KEY에만 둔다.
const { TYPES, THICKS, COLORS } = require("../js/recommend");

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const PROMPT =
  "이 옷 사진을 보고 type(상의/하의/아우터), " +
  `color(${COLORS.join(", ")} 중 하나), ` +
  "thick(얇음/보통/두꺼움), name(짧은 이름)을 JSON으로만 답해줘. " +
  '예: {"type":"상의","color":"네이비","thick":"보통","name":"네이비 니트"}. ' +
  '옷이 아니면 {"type":null,"color":null,"thick":null,"name":null}로 답해줘.';

// Gemini 답에서 JSON만 꺼낸다 (```json ... ``` 감싸기 대비)
function parseJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// 허용된 값만 통과시킨다
function normalize(raw) {
  const pick = (v, list) => (list.includes(v) ? v : null);
  const out = {
    type: pick(raw?.type, TYPES),
    color: pick(raw?.color, COLORS),
    thick: pick(raw?.thick, THICKS),
    name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 20) : null
  };
  out.ok = Boolean(out.type && out.color && out.thick);
  return out;
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 지원합니다" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY 환경변수가 없습니다" });

  const image = req.body?.image;
  const m = typeof image === "string" && image.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: "image(data URL)가 필요합니다" });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: PROMPT },
            { inline_data: { mime_type: m[1], data: m[2] } }
          ] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 }
        })
      }
    );
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || "Gemini 호출 실패" });

    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    return res.status(200).json(normalize(parseJson(text)));
  } catch (e) {
    return res.status(502).json({ error: e.message || "인식 중 오류" });
  }
}

module.exports = handler;
module.exports.parseJson = parseJson;
module.exports.normalize = normalize;
