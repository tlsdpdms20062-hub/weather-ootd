// F3 색조합 규칙 + F4 코디 추천 (규칙 기반, PRD 5장)
// 브라우저(<script>)와 Node(테스트) 양쪽에서 쓸 수 있게 만든다.
(function (root) {
  const TYPES = ["상의", "하의", "아우터"];
  const THICKS = ["얇음", "보통", "두꺼움"];

  // 색 그룹 (PRD 16색 전부)
  const colorGroup = {
    블랙: "무채색", 화이트: "무채색", 그레이: "무채색",
    베이지: "뉴트럴", 브라운: "뉴트럴", 카키: "뉴트럴", 아이보리: "뉴트럴",
    네이비: "쿨톤", 블루: "쿨톤", 데님: "쿨톤", 그린: "쿨톤",
    레드: "포인트", 옐로: "포인트", 핑크: "포인트", 오렌지: "포인트", 퍼플: "포인트"
  };
  const COLORS = Object.keys(colorGroup);

  // 상하의 색조합 점수 (행 = 상의, 열 = 하의)
  const colorScore = {
    무채색: { 무채색: 90, 뉴트럴: 85, 쿨톤: 90, 포인트: 80 },
    뉴트럴: { 무채색: 85, 뉴트럴: 75, 쿨톤: 90, 포인트: 60 },
    쿨톤:   { 무채색: 90, 뉴트럴: 90, 쿨톤: 70, 포인트: 55 },
    포인트: { 무채색: 80, 뉴트럴: 60, 쿨톤: 55, 포인트: 30 }
  };

  // ① 기온 → 두께. 최고기온으로 상의·하의, 최저기온으로 아우터를 정한다.
  function getThickness(minTemp, maxTemp) {
    let top, bottom, outer;

    if (maxTemp >= 17)      top = ["얇음"];            // 23↑ 반팔, 17~22 긴팔·셔츠
    else if (maxTemp >= 12) top = ["보통"];            // 맨투맨, 니트
    else if (maxTemp >= 5)  top = ["보통", "두꺼움"];  // 보통~두꺼움
    else                    top = ["두꺼움"];

    if (maxTemp >= 23)      bottom = "얇음";
    else if (maxTemp >= 5)  bottom = "보통";
    else                    bottom = "두꺼움";

    if (minTemp >= 17)      outer = null;              // 아우터 필요 없음
    else if (minTemp >= 12) outer = "얇음";
    else if (minTemp >= 5)  outer = "보통";
    else                    outer = "두꺼움";

    // F2 규칙: 일교차 8° 이상이면 아침·저녁용 얇은 아우터를 챙긴다.
    if (outer === null && maxTemp - minTemp >= 8) outer = "얇음";

    return { top, bottom, outer };
  }

  // ② 추천 이유 문구
  function makeReason(topG, bottomG, minTemp, needOuter, hasOuter) {
    let r;
    if (topG === "포인트" && bottomG === "포인트") r = "강한 색끼리는 부딪힐 수 있어요";
    else if (topG === "무채색" || bottomG === "무채색") r = "무채색은 어떤 색과도 잘 어울려요";
    else if ((topG === "쿨톤" && bottomG === "뉴트럴") || (topG === "뉴트럴" && bottomG === "쿨톤"))
      r = "차분한 쿨톤과 따뜻한 뉴트럴이 균형을 맞춰줘요";
    else if (topG === bottomG) r = `같은 ${topG} 계열이라 톤이 통일돼요`;
    else r = `${topG} 상의에 ${bottomG} 하의로 포인트를 줬어요`;

    if (needOuter) {
      r += hasOuter
        ? ` · 아침 ${minTemp}°라 아우터를 껴입어요`
        : ` · 아침 ${minTemp}°라 아우터가 필요한데 맞는 아우터가 없어요`;
    }
    return r;
  }

  // ③ 조건에 맞는 옷이 없는 종류 (옷 부족 안내용)
  function findMissing(closet, need) {
    const missing = [];
    if (!closet.some(c => c.type === "상의" && need.top.includes(c.thick))) missing.push("상의");
    if (!closet.some(c => c.type === "하의" && c.thick === need.bottom)) missing.push("하의");
    if (need.outer && !closet.some(c => c.type === "아우터" && c.thick === need.outer)) missing.push("아우터");
    return missing;
  }

  // ④ 가능한 모든 코디를 점수 높은 순으로 반환
  function rankLooks(closet, minTemp, maxTemp) {
    const need = getThickness(minTemp, maxTemp);
    const known = c => colorGroup[c.color] !== undefined;   // 모르는 색은 제외

    const tops    = closet.filter(c => c.type === "상의" && need.top.includes(c.thick) && known(c));
    const bottoms = closet.filter(c => c.type === "하의" && c.thick === need.bottom && known(c));
    const outers  = need.outer
      ? closet.filter(c => c.type === "아우터" && c.thick === need.outer && known(c))
      : [];

    const looks = [];
    for (const top of tops) {
      for (const bottom of bottoms) {
        const tg = colorGroup[top.color];
        const bg = colorGroup[bottom.color];

        // 아우터는 하의와 색 점수가 가장 높은 것을 고른다
        let outer = null;
        for (const o of outers) {
          if (!outer || colorScore[colorGroup[o.color]][bg] > colorScore[colorGroup[outer.color]][bg]) outer = o;
        }

        looks.push({
          top, bottom, outer,
          needOuter: need.outer !== null,
          score: colorScore[tg][bg],
          reason: makeReason(tg, bg, minTemp, need.outer !== null, outer !== null)
        });
      }
    }

    looks.sort((a, b) => b.score - a.score);
    return looks;
  }

  // ⑤ page 0 → 1~3위, page 1 → 4~6위 ("다시 추천")
  function recommend(closet, minTemp, maxTemp, page = 0) {
    return rankLooks(closet, minTemp, maxTemp).slice(page * 3, page * 3 + 3);
  }

  const api = { TYPES, THICKS, COLORS, colorGroup, colorScore,
                getThickness, makeReason, findMissing, rankLooks, recommend };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Reco = api;
})(this);
