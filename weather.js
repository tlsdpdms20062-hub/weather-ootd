// GET /api/weather → { minTemp, maxTemp, range, pop, needOuter, umbrella, ... }
// 기상청 키는 Vercel 환경변수 KMA_SERVICE_KEY(공공데이터포털 "Decoding" 키)에만 둔다.
const { NX, NY, baseFor, summarize } = require("../lib/kma");

const URL_BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";

module.exports = async (req, res) => {
  const key = process.env.KMA_SERVICE_KEY;
  if (!key) return res.status(500).json({ error: "KMA_SERVICE_KEY 환경변수가 없습니다" });

  const base = baseFor(new Date());
  const params = new URLSearchParams({
    serviceKey: key,
    pageNo: "1",
    numOfRows: "1000",
    dataType: "JSON",
    base_date: base.base_date,
    base_time: base.base_time,
    nx: String(NX),
    ny: String(NY)
  });

  try {
    const r = await fetch(`${URL_BASE}?${params}`);
    const text = await r.text();

    let data;
    try { data = JSON.parse(text); }
    catch { // 키 오류 등은 XML로 온다
      return res.status(502).json({ error: "기상청 응답 오류 (서비스 키를 확인하세요)", detail: text.slice(0, 200) });
    }

    const header = data?.response?.header;
    if (header?.resultCode !== "00") {
      return res.status(502).json({ error: `기상청 오류: ${header?.resultMsg || "알 수 없음"}` });
    }

    const items = data.response.body?.items?.item || [];
    const summary = summarize(items, base.target);

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=600"); // 30분 캐시
    return res.status(200).json({ ...summary, date: base.target, location: "서울 동작구" });
  } catch (e) {
    return res.status(502).json({ error: e.message || "날씨를 불러오지 못했습니다" });
  }
};
