// 기상청 단기예보 처리 도우미 (F2)
// 위치: 서울 동작구 고정 (격자 nx=59, ny=125)
const NX = 59, NY = 125;
const FROM_HOUR = 8;   // 등교
const TO_HOUR = 18;    // 귀가

const pad = n => String(n).padStart(2, "0");

// 한국시간 기준 날짜 문자열 YYYYMMDD
function kstYmd(date) {
  const k = new Date(date.getTime() + 9 * 3600 * 1000);
  return `${k.getUTCFullYear()}${pad(k.getUTCMonth() + 1)}${pad(k.getUTCDate())}`;
}

// 오늘 08~18시가 모두 들어 있는 발표 시각을 고른다.
// 02:00 발표는 02:10쯤 올라오므로, 그 전이면 전날 23:00 발표를 쓴다.
function baseFor(now = new Date()) {
  const k = new Date(now.getTime() + 9 * 3600 * 1000);
  const minutes = k.getUTCHours() * 60 + k.getUTCMinutes();
  const today = kstYmd(now);
  if (minutes >= 2 * 60 + 15) return { base_date: today, base_time: "0200", target: today };
  const yesterday = kstYmd(new Date(now.getTime() - 24 * 3600 * 1000));
  return { base_date: yesterday, base_time: "2300", target: today };
}

// 예보 항목 → 등교~귀가 최저·최고 기온, 최대 강수확률
function summarize(items, target) {
  const temps = [], pops = [];
  for (const it of items) {
    if (it.fcstDate !== target) continue;
    const hour = Number(String(it.fcstTime).slice(0, 2));
    if (hour < FROM_HOUR || hour > TO_HOUR) continue;
    const v = Number(it.fcstValue);
    if (Number.isNaN(v)) continue;
    if (it.category === "TMP") temps.push(v);
    if (it.category === "POP") pops.push(v);
  }
  if (temps.length === 0) throw new Error("오늘 등교~귀가 시간대 예보가 없습니다");

  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const pop = pops.length ? Math.max(...pops) : 0;
  const range = Math.round((maxTemp - minTemp) * 10) / 10;
  return {
    minTemp, maxTemp, range, pop,
    needOuter: range >= 8,     // 일교차 8° 이상
    umbrella: pop >= 60,       // 강수확률 60% 이상
    from: FROM_HOUR, to: TO_HOUR
  };
}

module.exports = { NX, NY, baseFor, summarize, kstYmd };
