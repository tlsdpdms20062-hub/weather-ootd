// node tests/test.js
const assert = require("assert");
const R = require("../js/recommend");
const K = require("../lib/kma");
const S = require("../api/scan");

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("✅", name); };

const mk = (id, type, color, thick) => ({ id, name: `${color} ${type}`, type, color, thick, image: "" });
// 성공 기준 옷장: 상의 4, 하의 3, 아우터 2
const closet = [
  mk("t1", "상의", "화이트", "얇음"), mk("t2", "상의", "네이비", "얇음"),
  mk("t3", "상의", "베이지", "보통"), mk("t4", "상의", "블랙", "두꺼움"),
  mk("b1", "하의", "데님", "얇음"), mk("b2", "하의", "베이지", "보통"), mk("b3", "하의", "블랙", "두꺼움"),
  mk("o1", "아우터", "카키", "보통"), mk("o2", "아우터", "블랙", "두꺼움")
];

t("16색 모두 그룹이 있음", () => assert.strictEqual(R.COLORS.length, 16));
t("아이보리/오렌지/퍼플 있어도 오류 없음", () => {
  const c = [mk("a", "상의", "퍼플", "얇음"), mk("b", "하의", "아이보리", "얇음"), mk("c", "하의", "오렌지", "얇음")];
  assert.strictEqual(R.rankLooks(c, 20, 27).length, 2);
});
t("PRD 두께표: 최고 20° → 상의 얇음(긴팔)", () => assert.deepStrictEqual(R.getThickness(18, 20).top, ["얇음"]));
t("PRD 두께표: 최고 8° → 상의 보통~두꺼움", () => assert.deepStrictEqual(R.getThickness(3, 8).top, ["보통", "두꺼움"]));
t("최고 25° → 하의 얇음", () => assert.strictEqual(R.getThickness(20, 25).bottom, "얇음"));
t("최저 6° → 아우터 보통", () => assert.strictEqual(R.getThickness(6, 15).outer, "보통"));
t("최저 18°, 일교차 9° → 얇은 아우터", () => assert.strictEqual(R.getThickness(18, 27).outer, "얇음"));
t("최저 18°, 일교차 5° → 아우터 없음", () => assert.strictEqual(R.getThickness(18, 23).outer, null));
t("네이비+베이지 = 90점, 쿨톤+뉴트럴 문구", () => {
  const tg = R.colorGroup["네이비"], bg = R.colorGroup["베이지"];
  assert.strictEqual(R.colorScore[tg][bg], 90);
  assert.ok(R.makeReason(tg, bg, 10, false, false).includes("쿨톤과 따뜻한 뉴트럴"));
});
t("포인트+포인트 문구", () => assert.ok(R.makeReason("포인트", "포인트", 20, false, false).includes("부딪힐")));
t("날씨 이유에 최저기온 포함", () => assert.ok(R.makeReason("무채색", "쿨톤", 6, true, true).includes("아침 6°")));
t("25°: 두꺼운 바지 추천 안 됨", () => {
  const looks = R.rankLooks(closet, 20, 25);
  assert.ok(looks.length > 0 && looks.every(l => l.bottom.thick === "얇음"));
});
t("점수 내림차순 정렬", () => {
  const looks = R.rankLooks(closet, 20, 25);
  for (let i = 1; i < looks.length; i++) assert.ok(looks[i - 1].score >= looks[i].score);
});
t("다시 추천: page 1은 4위부터", () => {
  const many = [...Array(4)].map((_, i) => mk("x" + i, "상의", R.COLORS[i * 4], "얇음"))
    .concat([mk("y1", "하의", "블랙", "얇음"), mk("y2", "하의", "데님", "얇음")]);
  const all = R.rankLooks(many, 24, 28);
  assert.deepStrictEqual(R.recommend(many, 24, 28, 1), all.slice(3, 6));
});
t("옷 부족 → 빈 배열 + 부족한 종류", () => {
  assert.strictEqual(R.rankLooks([mk("b", "하의", "블랙", "보통")], 10, 15).length, 0);
  assert.deepStrictEqual(R.findMissing([], R.getThickness(10, 15)), ["상의", "하의", "아우터"]);
});
t("아우터 필요하지만 없으면 안내 문구", () => {
  const c = [mk("t", "상의", "블랙", "보통"), mk("b", "하의", "데님", "보통")];
  const [l] = R.rankLooks(c, 6, 14);
  assert.ok(l.needOuter && l.outer === null && l.reason.includes("맞는 아우터가 없어요"));
});

// 성공 기준: 기온대마다 1개 이상 → 기본 옷장으로는 어느 기온대에서 부족한지 확인
t("성공 기준 옷장 기온대별 결과 출력", () => {
  for (const [mn, mx] of [[22, 28], [16, 21], [10, 15], [3, 9], [-5, 2]]) {
    const l = R.rankLooks(closet, mn, mx);
    console.log(`   ${mn}~${mx}° → ${l.length}개`, l.length ? "" : `(부족: ${R.findMissing(closet, R.getThickness(mn, mx))})`);
  }
});

// 날씨
t("발표시각: 02:15 이전 → 전날 2300", () => {
  const b = K.baseFor(new Date("2026-11-25T16:30:00Z")); // KST 11/26 01:30
  assert.deepStrictEqual(b, { base_date: "20261125", base_time: "2300", target: "20261126" });
});
t("발표시각: 아침 → 당일 0200", () => {
  const b = K.baseFor(new Date("2026-11-25T22:00:00Z")); // KST 11/26 07:00
  assert.deepStrictEqual(b, { base_date: "20261126", base_time: "0200", target: "20261126" });
});
t("08~18시만 집계, 일교차·우산 판단", () => {
  const items = [];
  for (let h = 3; h <= 23; h++) {
    const hh = String(h).padStart(2, "0") + "00";
    items.push({ category: "TMP", fcstDate: "20261126", fcstTime: hh, fcstValue: String(h) });
    items.push({ category: "POP", fcstDate: "20261126", fcstTime: hh, fcstValue: h === 20 ? "90" : "60" });
  }
  items.push({ category: "TMP", fcstDate: "20261127", fcstTime: "1200", fcstValue: "-10" });
  const s = K.summarize(items, "20261126");
  assert.strictEqual(s.minTemp, 8); assert.strictEqual(s.maxTemp, 18);
  assert.strictEqual(s.range, 10); assert.ok(s.needOuter);
  assert.strictEqual(s.pop, 60); assert.ok(s.umbrella);
});

// 스캔 응답 처리
t("Gemini 응답 ```json 감싸도 파싱", () =>
  assert.deepStrictEqual(S.parseJson('```json\n{"type":"상의"}\n```'), { type: "상의" }));
t("허용 안 된 값은 null, ok=false", () => {
  const r = S.normalize({ type: "상의", color: "민트", thick: "보통", name: "민트 티" });
  assert.strictEqual(r.color, null); assert.strictEqual(r.ok, false);
});
t("정상 응답 ok=true", () =>
  assert.ok(S.normalize({ type: "하의", color: "데님", thick: "보통", name: "청바지" }).ok));

t("index.html 안의 추천 로직이 js/recommend.js와 같음", () => {
  const fs = require("fs"), path = require("path");
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const reco = fs.readFileSync(path.join(__dirname, "../js/recommend.js"), "utf8");
  assert.ok(html.includes(reco), "js/recommend.js를 고쳤으면 index.html에도 똑같이 반영하세요");
});

console.log(`\n${n}개 테스트 통과`);
