# 날씨 맞춤 옷코디 추천 웹서비스 (AI개발과실전 1조)

## 폴더 구조
```
index.html        화면 4개 + 스타일 + 화면 동작 (파일 하나로 합침, 더블클릭으로 바로 열림)

js/recommend.js   F3·F4 추천 로직 원본 (api/scan.js가 사용, index.html 안에도 같은 내용)

api/weather.js    F2 기상청 단기예보 → 08~18시 최저·최고 기온, 강수확률
api/scan.js       F1 Gemini로 옷 사진 인식 → {type, color, thick, name}
lib/kma.js        기상청 발표시각 계산, 예보 요약
tests/test.js     로직 테스트 (node tests/test.js)
```

## 배포 (Vercel)
1. GitHub에 올린다. `.env` 파일은 `.gitignore`에 있어서 올라가지 않는다.
2. Vercel에서 저장소를 Import한다. 빌드 설정은 그대로 두면 된다.
3. Settings → Environment Variables에 다음을 넣고 다시 배포한다.

| 이름 | 값 |
| --- | --- |
| `KMA_SERVICE_KEY` | 공공데이터포털 단기예보 **Decoding** 키 |
| `GEMINI_API_KEY` | Google AI Studio 키 |
| `GEMINI_MODEL` (선택) | 기본값 `gemini-2.5-flash`. 모델 이름이 바뀌면 여기만 바꾼다 |

## 로컬에서 실행
- API까지 확인하려면 `npx vercel dev`를 쓴다. `.env.local`에 위 키를 넣는다.
- 화면만 확인하려면 아무 정적 서버로 열고 `index.html?min=6&max=15&pop=70`처럼 기온을 주소에 넣는다. 날씨 API가 실패해도 메인 화면에서 기온을 직접 입력할 수 있다.

## 테스트
```
npm test
```
