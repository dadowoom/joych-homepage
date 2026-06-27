# Sarang.org Homepage Deep Analysis Report

분석일: 2026-05-26 KST
대상: https://www.sarang.org/
목적: 현재 제작 중인 교회/사역 홈페이지에 적용할 수 있도록 공개 페이지, 공개 HTML, 공개 CSS/JS, 응답 헤더, 정보구조, UX 패턴을 해부한다.

## 0. 분석 범위와 한계

이 보고서는 공개적으로 접근 가능한 범위만 분석한다.

분석 가능:

- 렌더링된 정보구조, 메뉴, 페이지 섹션, 링크 흐름
- 공개 HTML, 공개 CSS/JS, 공개 이미지, 공개 플러그인
- 응답 헤더, 쿠키 속성, 외부 도메인 연결
- SEO, 접근성, 성능, 보안 헤더 수준의 개선점
- 현재 프로젝트(`joych-homepage`)에 적용할 정보구조와 구현 전략

분석 불가:

- 서버 내부 ASP 원본 코드
- DB 스키마와 관리자 로직
- 비공개 API, 로그인 이후 화면, 내부 로그
- 허가받지 않은 취약점 공격성 테스트

즉, 이 보고서는 "따라 만들기"가 아니라 "좋은 구조는 흡수하고, 낡은 구현은 현대식으로 개선하는" 적용 문서다.

## 1. 한 줄 결론

사랑의교회 홈페이지는 교회 소개형 사이트가 아니라 `교회 운영 포털`이다. 핵심은 예쁜 첫 화면보다 `예배`, `설교`, `공지`, `교육 신청`, `새가족`, `기도`, `검색`, `다국어/외부 사역`을 한 화면에서 빠르게 연결하는 것이다.

따라서 우리 사이트도 단순 랜딩 페이지로 만들면 밀도가 부족하다. 대신 "처음 온 사람", "기존 성도", "섬김/교육 신청자", "설교를 찾는 사람", "관리자"가 각각 1~2클릭 안에 목적지로 가는 포털형 정보구조가 맞다.

## 2. 측정 요약

### 2.1 홈 페이지 관측치

| 항목 | 값 |
|---|---:|
| 홈 HTML 크기 | 약 73,383 bytes |
| 홈 링크 수 | 약 198개 |
| 홈 이미지 수 | 약 18개, 실제 활성 이미지 15개 |
| 홈 폼 수 | 1개, 검색 폼 |
| 활성 CSS | 11개, 알려진 합계 약 1.34MB |
| 활성 JS | 10개, 알려진 합계 약 1.42MB |
| 활성 이미지 | 15개, 알려진 합계 약 0.93MB |
| 홈 초기 공개 자산 총량 | 알려진 값 기준 약 3.69MB + HTML |

### 2.2 주요 공개 페이지

| 페이지 | URL | HTML 크기 | 링크 | 이미지 | 폼 |
|---|---|---:|---:|---:|---:|
| 홈 | `/` | 73KB | 198 | 18 | 1 |
| 예배시간 | `/info/worshiptime.asp` | 62KB | 131 | 2 | 0 |
| 공지사항 | `/info/notice.asp` | 43KB | 146 | 12 | 1 |
| 설교 | `/tv/sermon.asp?sflag=sun` | 78KB | 161 | 7 | 2 |
| 부서 홈페이지 | `/ministry/div_sitemap.asp` | 40KB | 202 | 2 | 0 |
| 이용안내 | `/help/guide.asp` | 35KB | 132 | 2 | 1 |

### 2.3 응답 헤더 관측치

| 항목 | 관측 |
|---|---|
| 서버 | `Microsoft-IIS/10.0` |
| 백엔드 힌트 | `ASP.NET`, `.asp`, `ASPSESSIONID` |
| HTTPS | `http://www.sarang.org/`는 HTTPS로 301 이동 |
| apex 도메인 | `https://sarang.org/`도 200 응답, `www`로 정규화되지는 않음 |
| Content-Type | `text/html`, charset 없음 |
| Cache-Control | `private` |
| Cookie | `PC_MO=PC; path=/`, `ASPSESSIONID...; path=/` |
| HSTS | 관측 안 됨 |
| CSP | 관측 안 됨 |
| X-Frame-Options | 관측 안 됨 |
| X-Content-Type-Options | 관측 안 됨 |
| Referrer-Policy | 관측 안 됨 |
| Permissions-Policy | 관측 안 됨 |

### 2.4 검색/크롤링

- `robots.txt`는 기본 `Disallow: /` 후 일부 경로만 허용하는 방식이다.
- `/sitemap.xml`은 404로 관측됐다.
- 네이버 사이트 검증 메타가 있다.
- canonical URL은 홈에서 관측되지 않았다.

적용 판단:

- 우리 사이트는 검색 유입을 원한다면 `robots.txt`, `sitemap.xml`, canonical, 페이지별 메타, 구조화 데이터를 처음부터 정리해야 한다.

## 3. 사이트의 본질

### 3.1 사랑의교회 사이트가 해결하는 문제

교회 홈페이지 방문자의 의도는 대체로 즉시성이 강하다.

- "예배 시간이 언제지?"
- "이번 주 설교 어디서 보지?"
- "주보 어디 있지?"
- "새가족 등록 어디서 하지?"
- "교육 신청 마감됐나?"
- "교회 위치와 주차는?"
- "공지사항 확인해야 하는데?"
- "기도제목/중보기도 요청은?"

사랑의교회 홈은 이 의도를 홈에서 바로 처리한다. 교회 브랜드 스토리보다 운영 정보와 반복 방문 동선을 우선한다.

### 3.2 핵심 UX 전략

좋은 점:

- 상단 메가 메뉴로 전체 서비스를 한 번에 노출한다.
- 홈에 반복 방문 메뉴를 여러 번 배치한다.
- `설교ㆍ찬양`, `공지사항`, `교육ㆍ훈련`, `말씀`, `기도`, `검색`을 홈의 큰 축으로 만든다.
- 외부 사역 사이트와 다국어 사이트를 적극 연결한다.
- 최신 콘텐츠 날짜가 보여 사이트가 살아 있다는 인상을 준다.

주의할 점:

- 선택지가 많아 초신자/처음 방문자에게는 정보 밀도가 높다.
- 카드와 링크가 많아 모바일에서는 우선순위가 흐려질 수 있다.
- 시각적으로는 현대적이지만 코드 구조는 레거시 의존성이 강하다.

우리 사이트 적용 원칙:

- 홈은 "감성 소개"보다 "교회 생활의 관문"이어야 한다.
- 처음 방문자는 `처음 오셨나요`, 기존 성도는 `주보/설교/공지`, 사역자는 `교육/신청/행정`, 관리자는 `콘텐츠 관리`로 빠르게 분기시킨다.

## 4. 정보구조 해부

### 4.1 1차 내비게이션

사랑의교회 홈의 상위 메뉴는 크게 네 축이다.

1. 교회소개
2. 설교ㆍ찬양
3. 목양ㆍ사역
4. 교육ㆍ훈련

각 축은 메가 메뉴로 세분화된다.

교회소개:

- 교회안내: 공동체고백, 비전/심벌, 역사, 사역계승
- 섬기는 사람들: 담임목사, 교역자, 장로, 권사, 집사, 직원
- 교회정보: 예배시간, 약도/주차, 시설, 전화번호, 온라인 헌금, 사역일정, e교회행정, 공지, 주보, 기부금영수증

설교ㆍ찬양:

- 설교: 주일예배, 수요저녁기도회, 새벽기도회, 특별새벽부흥회, 청년/대학/주일학교/장애인 부서 등
- 찬양: 찬양대, 특송, 마음을 여는 찬양 등
- 뉴스ㆍ행사: NEWSROOM, 행사/집회/공연, 예배 생방송

목양ㆍ사역:

- 새가족: 등록 안내, 등록, 등록자, 모임 안내, 수료자, 학습/세례
- 양육: 목양 편성도, 다락방, 순장 모임, 양육 과정
- 부서안내: 부서 홈페이지, 사역소개, 간행물

교육ㆍ훈련:

- 훈련: 새가족, 제자훈련, 사역훈련, 성경대학, 교리대학, 큐티 등
- 선교ㆍ전도
- 주일학교
- 가정사역
- 기타 교육훈련

### 4.2 적용용 메뉴 설계

우리 사이트는 처음부터 메뉴를 하드코딩하지 말고 데이터로 관리해야 한다.

추천 상위 메뉴:

1. 교회안내
2. 예배와 말씀
3. 다음세대/사역
4. 교육과 양육
5. 새가족
6. 소식과 신청

추천 유틸리티:

- 예배시간
- 오시는 길
- 주보
- 생방송
- 새가족 등록
- 온라인 헌금
- 검색
- 로그인/관리자

중요:

- 메가 메뉴는 데스크톱에서 좋지만 모바일에서는 아코디언/검색이 더 중요하다.
- 메뉴 데이터는 `shared/navigation.ts` 같은 단일 소스로 만들고, 헤더/푸터/사이트맵/관리자 메뉴가 같은 데이터를 쓰게 한다.

## 5. 홈 화면 섹션 해부

사랑의교회 홈은 다음 흐름을 갖는다.

1. 헤더/메가 메뉴
2. 유틸리티 링크: 생방송, 은혜게시판 등
3. 외부 핵심 링크: SaRang ON, SaGA, WEA, 기도 캠페인
4. 설교ㆍ찬양 카드
5. 반복 방문 퀵 링크: 새가족 등록, 약도/주차, 주보, 예배시간
6. 공지사항
7. 교회 인물/뉴스 링크
8. 교육ㆍ훈련 신청 카드
9. 말씀: 오늘의 QT, 365구절, 암송구절
10. 기도 링크
11. 검색
12. 푸터/다국어

### 5.1 이 구조가 좋은 이유

- 홈에서 "최근 콘텐츠"와 "고정 업무"를 동시에 해결한다.
- 설교, 공지, 교육 신청처럼 업데이트되는 콘텐츠가 사이트 생동감을 만든다.
- 예배시간/주보/새가족/위치처럼 반복 수요가 많은 기능을 바로 노출한다.
- 검색을 하단에 두어 메뉴에서 못 찾은 사람을 구제한다.

### 5.2 우리 사이트 홈 와이어프레임

권장 첫 화면:

1. 상단 고정 헤더
   - 로고
   - 메가 메뉴
   - 생방송
   - 검색
   - 로그인/관리자

2. 즉시 행동 바
   - 예배시간
   - 오시는 길
   - 주보
   - 새가족
   - 온라인 헌금

3. 주간 핵심 콘텐츠
   - 이번 주 설교 대표 카드
   - 최신 찬양/예배 영상
   - 공지 3~5개

4. 새가족/처음 방문자 섹션
   - 교회 소개 요약
   - 예배 안내
   - 등록/문의

5. 사역/교육 신청 섹션
   - 모집중/마감 구분
   - 신청기간
   - 대상

6. 말씀/기도 섹션
   - 오늘의 말씀
   - 기도 요청
   - 공동 기도 제목

7. 통합 검색
   - 설교, 공지, 사역, 교육, 주보를 한 번에 검색

## 6. 디자인 시스템 해부

### 6.1 색상

공개 CSS에서 가장 많이 쓰이는 색상 계열:

| 역할 | 색상 |
|---|---|
| 배경/카드 | `#fff`, `#fefefe`, `#f6f7f9` |
| 주 브랜드 | `#02368c` |
| 본문/헤딩 | `#343f52`, `#262b32`, `#60697b` |
| 보조 회색 | `#9499a3`, `#aab0bc`, `#dfe0e3` |
| 포인트 | `#45c4a0`, `#fab758`, `#54a8c7`, `#e2626b`, `#fb7c44` |

핵심 패턴:

- 흰색/밝은 회색 바탕
- 진한 남색을 신뢰의 기준색으로 사용
- 카드/상태/카테고리에 여러 보조색을 사용

우리 사이트 적용:

- 하나의 파란색만 반복하지 말고, `브랜드색 + 상태색 + 섹션색`을 분리한다.
- 교회 사이트는 너무 어둡거나 과한 그라데이션보다 밝고 신뢰감 있는 배경이 좋다.
- 포인트 색은 신청 상태, 라이브, 새가족, 말씀, 기도처럼 기능에 매핑한다.

추천 토큰:

```css
:root {
  --color-brand: #123f7a;
  --color-brand-strong: #082b59;
  --color-ink: #223044;
  --color-muted: #667085;
  --color-surface: #ffffff;
  --color-soft: #f5f7fb;
  --color-live: #d92d20;
  --color-newcomer: #0e9384;
  --color-training: #b54708;
  --color-prayer: #6941c6;
}
```

### 6.2 타이포그래피

관측:

- `Noto Sans KR` 계열을 사용한다.
- 일부 템플릿 기본값으로 `Manrope` 흔적이 있다.
- Bootstrap 변수 기반 타이포그래피가 많이 보인다.

우리 사이트 적용:

- 한국 교회 사이트는 `Pretendard` 또는 `Noto Sans KR`가 안정적이다.
- 제목은 너무 굵고 큰 랜딩 페이지 스타일보다, 정보 스캔에 맞춘 계층이 낫다.
- 설교 제목/공지 제목/교육명은 2줄 말줄임 기준을 정해야 한다.

### 6.3 컴포넌트 언어

자주 등장하는 컴포넌트:

- 메가 메뉴
- 모바일 오프캔버스 메뉴
- 카드
- 미디어 카드
- 공지 리스트
- 퀵 메뉴
- 상태 배지
- 검색 폼
- 마퀴 태그/키워드
- 비디오/오디오 플레이어
- 푸터 다국어 드롭다운

우리 사이트 컴포넌트 목록:

- `SiteHeader`
- `MegaNavigation`
- `MobileNavigation`
- `QuickActionBar`
- `LatestSermonCard`
- `MediaCard`
- `NoticeList`
- `TrainingCard`
- `NewcomerPanel`
- `DevotionalPanel`
- `PrayerLinks`
- `GlobalSearch`
- `FooterSitemap`

## 7. 기술 스택 해부

### 7.1 관측된 서버/프론트 구조

백엔드:

- IIS 10
- ASP.NET
- `.asp` 페이지
- ASP 세션 쿠키
- 서버 사이드 렌더링된 HTML

프론트:

- jQuery 3.7.1
- Bootstrap 5.2.2 계열
- Bootstrap Icons
- jquery-confirm
- Video.js 7.14.3
- Swiper
- GLightbox
- Isotope
- Masonry
- ScrollCue
- Marquee 플러그인
- 커스텀 JS: 로그인 이동, 검색 검증, 팝업 쿠키, 플레이어 제어, 캐러셀 AJAX

### 7.2 활성 자산

활성 CSS:

- `/assets/css/plugins.css`
- `/assets/css/form.css`
- `/assets/css/common.css`
- `/assets/css/style.css`
- `/assets/css/custom.css`
- `/assets/css/bootstrap-icons.../bootstrap-icons.min.css`
- `/plugin/confirm/jquery-confirm.min.css`
- `/plugin/videojs/7.14.3/video-js.css`
- `/assets/css/tv.css`
- `/assets/css/full.css`
- `/plugIn/Marquee/css/marquee.css`

활성 JS:

- `https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js`
- `/js/Script_Login.asp?...`
- `/plugin/confirm/jquery-confirm.js`
- `/plugIn/Marquee/js/marquee.js`
- `/js/cookiesFnc.js`
- `/assets/js/plugins.js`
- `/assets/js/theme.js`
- `/js/common.js`
- `/plugin/videojs/7.14.3/video.min.js`
- `/js/main.js`

### 7.3 기술적 장점

- 서버 렌더링이라 기본 콘텐츠가 HTML에 존재한다.
- JS가 실패해도 상당수 링크와 텍스트는 접근 가능하다.
- 페이지별 ASP 라우팅이 명확하다.
- Bootstrap 기반이라 레이아웃 일관성이 있다.

### 7.4 기술적 약점

- CSS/JS가 무겁다.
- `style.css` 하나가 약 918KB로 과대하다.
- `plugins.js` 하나가 약 739KB다.
- Video.js가 홈에서도 로드되어 초기 JS를 키운다.
- 자산 URL의 `?v=현재시각` 패턴은 캐시 효율을 낮출 수 있다.
- 주석 처리된 CDN/스크립트 흔적이 많아 유지보수성이 떨어진다.
- jQuery 중심 이벤트는 규모가 커질수록 상태 추적이 어렵다.

우리 사이트 적용:

- React/Radix/Tailwind/Vite 스택을 이미 쓰고 있으므로 jQuery 방식은 따라가지 않는다.
- 컴포넌트와 데이터 모델은 흡수하고, 구현은 현대식으로 만든다.
- 미디어 플레이어는 홈 초기 로드에서 제외하고 상세/모달 진입 시 lazy-load 한다.

## 8. 데이터 모델 추출

사랑의교회 홈을 보면 필요한 콘텐츠 엔티티가 선명하다.

### 8.1 MenuItem

```ts
type MenuItem = {
  id: string;
  label: string;
  href?: string;
  children?: MenuItem[];
  external?: boolean;
  audience?: "newcomer" | "member" | "leader" | "admin";
  order: number;
};
```

### 8.2 Sermon

```ts
type Sermon = {
  id: string;
  title: string;
  subtitle?: string;
  speaker: string;
  serviceType: string;
  preachedAt: string;
  scripture?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  notesUrl?: string;
};
```

### 8.3 Notice

```ts
type Notice = {
  id: string;
  title: string;
  startsAt?: string;
  endsAt?: string;
  category: "notice" | "event" | "recruit" | "worship";
  isPinned: boolean;
  href: string;
};
```

### 8.4 TrainingProgram

```ts
type TrainingProgram = {
  id: string;
  department: string;
  title: string;
  status: "open" | "closed" | "upcoming";
  applyStartAt?: string;
  applyEndAt?: string;
  target?: string;
  href: string;
};
```

### 8.5 WorshipService

```ts
type WorshipService = {
  id: string;
  name: string;
  dayOfWeek: string;
  time: string;
  location: string;
  audience?: string;
  interpretation?: string[];
};
```

### 8.6 QuickLink

```ts
type QuickLink = {
  id: string;
  label: string;
  href: string;
  icon: string;
  priority: number;
  audience?: "newcomer" | "member" | "visitor";
};
```

## 9. 성능 분석

### 9.1 병목

가장 큰 자산:

| 자산 | 크기 |
|---|---:|
| `/assets/css/style.css` | 약 918KB |
| `/assets/js/plugins.js` | 약 739KB |
| `/plugin/videojs/7.14.3/video.min.js` | 약 560KB |
| `/assets/img/main/pray_03.jpg` | 약 300KB |
| `/assets/css/plugins.css` | 약 169KB |

핵심 문제:

- 홈에서 필요하지 않은 플러그인까지 함께 로드될 가능성이 높다.
- CSS가 템플릿/부트스트랩/커스텀 누적으로 커졌다.
- 비디오 플레이어가 홈 초기 로드에 포함된다.
- 캐시 헤더가 적극적으로 설정되어 있지 않다.
- 동적 timestamp 쿼리로 브라우저 캐시 재사용성이 낮을 수 있다.

### 9.2 우리 사이트 성능 예산

권장 목표:

| 항목 | 목표 |
|---|---:|
| 홈 HTML | 80KB 이하 |
| 초기 JS | gzip 기준 180KB 이하 |
| 초기 CSS | gzip 기준 80KB 이하 |
| 첫 화면 이미지 | 200KB 이하 |
| 홈 초기 총량 | 1.2MB 이하 |
| LCP | 2.5초 이하 |
| INP | 200ms 이하 |
| CLS | 0.05 이하 |

구현 지침:

- 라우트 단위 코드 스플리팅을 켠다.
- 미디어 플레이어, 관리자 UI, 갤러리, 지도는 lazy-load 한다.
- 이미지 업로드 시 `sharp`로 WebP/AVIF 파생본을 만든다.
- 정적 자산은 해시 파일명으로 배포하고 `Cache-Control: public, max-age=31536000, immutable`을 준다.
- HTML/API는 짧게 캐시하고 정적 자산은 길게 캐시한다.

## 10. 접근성 분석

관측된 개선점:

- 일부 이미지에 `alt`가 없다.
- 많은 이미지가 `alt=""`로 비어 있다. 장식 이미지라면 괜찮지만, 로고/콘텐츠 썸네일이면 설명이 필요하다.
- 검색 폼의 `label for`와 실제 input id 연결이 약하다.
- 검색 버튼이 `<button>`이 아니라 `<div>` 기반이다.
- heading 계층이 시각적 용도로 섞여 있어 문서 구조가 완벽하지 않다.
- 외부 링크 아이콘/빈 텍스트 링크가 있어 스크린리더 사용성이 낮을 수 있다.

우리 사이트 접근성 기준:

- 모든 클릭 동작은 기본적으로 `<button>` 또는 `<a>`를 사용한다.
- `alt`는 장식/정보 이미지를 구분한다.
- 메뉴는 키보드로 열고 닫고 이동 가능해야 한다.
- 메가 메뉴는 `Radix NavigationMenu` 또는 접근성 검증된 컴포넌트로 만든다.
- 검색은 `label`, `aria-label`, submit 동작을 모두 갖춘다.
- 헤딩은 `h1` 1개, 섹션 `h2`, 카드 제목 `h3` 원칙을 둔다.
- 모달/오프캔버스는 focus trap과 ESC 닫기를 보장한다.

## 11. SEO 분석

좋은 점:

- 기본 title/description이 있다.
- Open Graph title/description/image가 있다.
- Naver site verification이 있다.
- 서버 렌더링 HTML이므로 검색 엔진이 텍스트를 읽기 쉽다.

개선점:

- canonical이 없다.
- `og:url`, `og:locale`, Twitter card가 부족하다.
- `/sitemap.xml`이 404로 관측됐다.
- robots 정책이 제한적이다.
- 페이지별 구조화 데이터가 관측되지 않는다.
- `meta name="keyword"`는 현대 SEO에서 영향이 작다.

우리 사이트 SEO 설계:

- 모든 페이지에 고유 title/description/canonical을 둔다.
- `sitemap.xml` 자동 생성.
- `robots.txt`는 의도에 맞게 명확히 작성.
- 구조화 데이터:
  - `Organization`
  - `WebSite` + `SearchAction`
  - `BreadcrumbList`
  - 설교 상세: `VideoObject` 또는 `AudioObject`
  - 행사/교육: `Event`
  - 공지/글: `Article`
- 이미지 공유용 OG 이미지를 자동 생성하거나 기본 이미지를 둔다.

## 12. 보안/프라이버시 분석

관측된 개선점:

- HSTS가 보이지 않는다.
- CSP가 보이지 않는다.
- X-Frame-Options 또는 frame-ancestors 정책이 보이지 않는다.
- X-Content-Type-Options가 보이지 않는다.
- Referrer-Policy가 보이지 않는다.
- Permissions-Policy가 보이지 않는다.
- 세션 쿠키에 `Secure`, `HttpOnly`, `SameSite`가 관측되지 않았다.
- `target="_blank"` 링크 다수에 `rel="noopener noreferrer"`가 없다.
- 로그인 이동 스크립트가 URL 파라미터 기반 redirect를 사용하므로 서버 측 allowlist 검증이 중요하다.

우리 사이트 보안 기본값:

```ts
app.use((_req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "media-src 'self' https:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "));
  next();
});
```

주의:

- YouTube, 지도, 외부 CDN, 결제/헌금, Google Tag Manager를 쓰면 CSP 허용 목록을 실제 도메인에 맞게 조정해야 한다.
- 세션 쿠키는 `HttpOnly`, `Secure`, `SameSite=Lax` 이상을 기본으로 둔다.
- 외부 링크 컴포넌트는 자동으로 `rel="noopener noreferrer"`를 붙인다.

## 13. 유지보수성 분석

사랑의교회 사이트는 운영 포털로서 콘텐츠 범위가 넓지만, 레거시 흔적이 있다.

관측:

- HTML에 주석 처리된 CSS/JS가 다수 있다.
- CSS가 템플릿 기반으로 크게 누적되어 있다.
- JS는 jQuery 이벤트 위임과 전역 함수가 많다.
- 로그인, 검색, 팝업, 플레이어가 전역 스크립트에 흩어져 있다.
- 페이지마다 같은 헤더/메뉴가 서버 include 형태로 반복되는 구조로 보인다.

우리 사이트에서는:

- 메뉴/푸터/퀵링크/외부링크를 DB 또는 typed config로 관리한다.
- 프론트 컴포넌트는 기능 단위로 나눈다.
- 관리자에서 콘텐츠 순서와 노출 상태를 관리한다.
- 배포 시 불필요한 주석과 미사용 CSS를 제거한다.
- `admin`, `public`, `shared`, `server` 경계를 명확히 둔다.

## 14. 현재 프로젝트 적용 설계

현재 `joych-homepage`는 React, Vite, Express, Drizzle, MySQL, Radix UI, Tailwind 계열을 사용할 수 있는 구조다. 이 구조는 사랑의교회식 포털 UX를 더 현대적으로 구현하기 좋다.

### 14.1 추천 아키텍처

```text
client/
  src/
    components/
      layout/
        SiteHeader.tsx
        MegaNavigation.tsx
        MobileNavigation.tsx
        FooterSitemap.tsx
      home/
        QuickActionBar.tsx
        LatestSermonSection.tsx
        NoticeTrainingSection.tsx
        NewcomerSection.tsx
        PrayerWordSection.tsx
        SiteSearchSection.tsx
      media/
        SermonCard.tsx
        MediaPlayerDialog.tsx
      content/
        StatusBadge.tsx
        SectionHeader.tsx
    data/
      navigation.ts
      quickLinks.ts
    routes/
      HomePage.tsx
      SermonsPage.tsx
      WorshipTimesPage.tsx
      NewcomerPage.tsx
      TrainingPage.tsx
      NoticePage.tsx
server/
  routes/
    publicContent.ts
    search.ts
    adminContent.ts
shared/
  schema.ts
  content-types.ts
```

### 14.2 홈 우선순위

P0: 반드시 첫 화면 근처

- 예배시간
- 오시는 길
- 주보
- 생방송
- 새가족 등록
- 최신 설교
- 공지사항

P1: 홈 중단

- 교육/훈련 신청
- 사역 소개
- 다음세대
- 오늘의 말씀/기도

P2: 홈 하단/푸터

- 부서 전체보기
- 다국어
- 약관/개인정보
- SNS/YouTube
- 상세 검색

### 14.3 검색 설계

사랑의교회 홈의 검색은 메뉴가 방대한 포털에서 필수 구제 장치다. 우리 사이트도 초기에 검색을 넣는 게 좋다.

검색 대상:

- 설교 제목/본문/성경구절
- 공지 제목/본문
- 교육명/부서명
- 사역명
- 예배명/장소
- 주보 파일명

UI:

- 데스크톱: 헤더 검색 아이콘 + 홈 하단 큰 검색
- 모바일: 상단 검색 버튼 + 전체화면 command palette

기술:

- 작은 규모: DB `LIKE`/fulltext + 서버 API
- 중간 규모: Meilisearch/Typesense
- 클라이언트 보조: `cmdk`

## 15. 무엇을 가져오고 무엇을 피할 것인가

### 가져올 것

- 포털형 홈 구조
- 메가 메뉴의 정보 분류 방식
- 반복 방문 퀵 링크
- 설교/공지/교육/말씀/기도의 홈 통합
- 최신 날짜와 상태 배지를 보여주는 방식
- 외부 사역/다국어 사이트 연결
- 검색을 명시적으로 제공하는 방식

### 더 좋게 만들 것

- 접근성 있는 메뉴/검색/버튼
- 페이지별 SEO와 구조화 데이터
- 미디어 lazy-load
- 이미지 자동 최적화
- 보안 헤더와 쿠키 속성
- 캐시 전략
- 관리자 중심 콘텐츠 운영

### 피할 것

- 홈에서 모든 플러그인을 한 번에 로드
- 거대한 단일 CSS/JS 파일
- `<div>` 클릭 버튼
- alt 없는 콘텐츠 이미지
- 매 요청마다 바뀌는 자산 query string
- 외부 링크 `noopener` 누락
- 서버/프레임워크 버전 노출
- 전역 함수와 jQuery 이벤트에 의존한 상태 관리

## 16. 구현 로드맵

### 1단계: 정보구조 확정

- 메뉴 트리 작성
- 홈 퀵 액션 5~6개 확정
- 콘텐츠 엔티티 정의
- 관리자에서 관리할 항목과 코드로 고정할 항목 구분

### 2단계: 홈 골격 구현

- Header/MegaNavigation
- QuickActionBar
- LatestSermonSection
- NoticeList
- TrainingCard
- NewcomerSection
- PrayerWordSection
- FooterSitemap

### 3단계: 데이터 연결

- 설교/공지/교육/예배시간 API
- 관리자 CRUD
- 노출 순서/상태/기간 관리
- 검색 API

### 4단계: 품질 기준 적용

- Lighthouse 성능 예산
- 키보드 내비게이션 테스트
- SEO 메타 자동화
- sitemap/robots 생성
- 보안 헤더 적용
- 이미지 파생본 생성

### 5단계: 운영 최적화

- 콘텐츠 예약 발행
- 마감일 자동 상태 변경
- 주보/설교 자동 정렬
- YouTube 또는 미디어 연동
- 관리자 대시보드

## 17. 최종 제안

사랑의교회 홈페이지에서 배울 핵심은 "홈페이지를 교회 생활의 운영판으로 만든다"는 점이다. 그러나 구현 방식은 그대로 따라가면 안 된다. 우리 프로젝트는 React/Radix/Tailwind/Express/Drizzle 기반이므로 더 가볍고 접근성 좋고 관리하기 쉬운 포털로 재해석하는 게 맞다.

최우선 구현 방향:

1. 홈을 포털형으로 재구성한다.
2. `예배시간`, `주보`, `생방송`, `새가족`, `오시는 길`을 고정 퀵 액션으로 둔다.
3. 설교/공지/교육을 데이터 기반 카드로 만든다.
4. 검색을 초기에 설계한다.
5. 보안 헤더, SEO, 이미지 최적화는 나중이 아니라 초기에 기본값으로 박아둔다.

이렇게 가면 사랑의교회가 가진 운영 밀도는 가져오면서, 레거시 무게와 접근성/보안 약점은 피할 수 있다.

## 18. 참고한 공개 URL

- https://www.sarang.org/
- https://www.sarang.org/info/worshiptime.asp
- https://www.sarang.org/info/notice.asp
- https://www.sarang.org/tv/sermon.asp?sflag=sun
- https://www.sarang.org/ministry/div_sitemap.asp
- https://www.sarang.org/help/guide.asp
- https://www.sarang.org/robots.txt
- https://www.sarang.org/assets/css/style.css
- https://www.sarang.org/assets/js/plugins.js
- https://www.sarang.org/plugin/videojs/7.14.3/video.min.js
