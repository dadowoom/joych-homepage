# 작업 규칙 문서

> 작성일: 2026-04-17  
> 마지막 업데이트: 2026-04-17 (세션 저장)  
> 목적: 세션 초기화 시에도 일관된 작업 진행을 위한 규칙 문서

---

## 핵심 작업 규칙

### 1. 작업 우선순위 규칙 ⭐ 중요
- **현재 진행 중인 작업을 완전히 완료한 후에 새 요청을 받아 진행한다.**
- 작업 도중 인식님이 새로운 요청을 하면 → 현재 작업을 먼저 완료 → 그 다음 새 요청 진행
- 단, 인식님이 명시적으로 "먼저 해라", "이거 먼저" 라고 하면 현재 작업을 중단하고 새 요청 우선 처리

### 2. 단계별 진행 원칙
- 빠르게 진행하기보다 하나씩 단계적으로 해결
- 문제 발생 시: 원인 파악 → 해결 방안 제시 → 승인 받기 → 수정 순서로 진행
- 큰 작업(DB 변경, 인증 구조 변경 등)은 반드시 계획 수립 후 승인 받고 진행

### 3. 승인 필수 항목
- DB 스키마 변경 (마이그레이션)
- 인증 시스템 변경
- 기존 기능에 영향을 주는 대규모 수정
- 새로운 기능 추가 전 설계 계획

### 4. 문서화 규칙
- 중요한 시스템 구조 변경 시 `docs/` 폴더에 MD 파일로 기록
- 작업 규칙 추가/변경 시 이 문서(work-rules.md)에 즉시 반영
- 세션 초기화 후 작업 시작 전 이 문서와 `docs/auth-system.md`, `docs/next-tasks.md` 반드시 확인

### 5. 코드 안전성 규칙
- 기존 코드 수정 시 기존 기능이 무너지지 않도록 점진적으로 변경
- 새 기능 추가 시 기존 코드 최소한으로 건드리기
- 체크포인트는 주요 기능 완료 후 반드시 저장

### 6. 사용자 커뮤니케이션 규칙
- 전문 용어 사용 시 바로 옆에 쉬운 설명 추가
- 작업 전 무엇을 할지 먼저 요약
- 작업 후 무엇이 바뀌었는지 간단히 정리
- 중요한 결정이나 위험한 수정은 반드시 먼저 확인 받기

---

## 프로젝트 구조 요약

### 인증 시스템
- **성도 로그인**: `church_member_session` 쿠키 기반, `trpc.members.me` 로 상태 확인
- **관리자 로그인**: Manus OAuth 기반, `useAuth()` / `ctx.user` 로 상태 확인
- **규칙**: 성도 기능에는 성도 로그인만 사용, Manus OAuth는 관리자 전용

### 주요 파일 위치
- DB 스키마: `drizzle/schema.ts`
- 서버 API: `server/routers.ts`
- DB 쿼리 헬퍼: `server/db.ts`
- 관리자 페이지: `client/src/pages/Admin.tsx`
- 동적 메뉴 페이지: `client/src/pages/DynamicPage.tsx`
- 서브 페이지 레이아웃: `client/src/components/SubPageLayout.tsx`
- 메뉴 편집 패널: `client/src/components/MenuEditPanel.tsx`
- 시설 예약 상세: `client/src/pages/FacilityDetail.tsx`
- 시설 예약 신청: `client/src/pages/FacilityApply.tsx`
- 내 예약 현황: `client/src/pages/MyReservations.tsx`

### appRouter 최상위 키 (중요 — admin 없음!)
| 키 | 용도 |
|---|---|
| `system` | 시스템 알림 등 |
| `auth` | Manus OAuth 로그인/로그아웃 |
| `home` | 공개 데이터 조회 (메뉴, 공지, 갤러리 등) |
| `cms` | 관리자 전용 CRUD (adminProcedure 보호) |
| `members` | 성도 회원가입/로그인/마이페이지 |

### 이미지 업로드 방식
- S3 업로드: `server/storage.ts`의 `storagePut()` 사용
- 업로드 API: `trpc.cms.upload.image` / `trpc.cms.upload.pageImage` (관리자 전용)
- **주의**: `trpc.admin.*` 는 존재하지 않음 — 반드시 `trpc.cms.*` 사용
- 이미지는 반드시 S3에 저장, DB에는 URL만 저장

### pageType 종류 (menu_items / menu_sub_items 테이블)
| pageType | 설명 | 현재 상태 |
|---|---|---|
| `image` | 전체화면 이미지 1장 표시 | 기본 구현 완료, 개선 예정 |
| `gallery` | 사진 갤러리 그리드 | 구현 완료 |
| `board` | 게시판 목록 | 구현 완료 |
| `youtube` | 유튜브 영상 목록 | 플레이스홀더 |
| `editor` | 블록 에디터 (텍스트+이미지) | 플레이스홀더 → 구현 예정 |

---

## ⏳ 다음 작업 계획 (세션 재시작 시 여기서부터!)

### 현재 진행 중인 작업
**이미지 전체화면 페이지 개선 + 블록 에디터 시스템 구축**

### Phase 2: 이미지 전체화면 페이지 개선 (다음 시작)
파일: `client/src/pages/DynamicPage.tsx` → `ImageContent` 컴포넌트

할 일:
1. 이미지를 페이지 너비에 꽉 차게 표시 (`w-full`, `object-cover`, 세로 비율 유지)
2. 이미지 클릭 시 라이트박스 (원본 크기 확대 보기, 배경 어둡게, ESC/클릭으로 닫기)
3. 이미지 없을 때 안내 문구 개선

### Phase 3: 블록 에디터 DB 설계
`drizzle/schema.ts`에 `page_blocks` 테이블 추가:
```
page_blocks
  id (PK)
  menuItemId (nullable) → menu_items.id
  menuSubItemId (nullable) → menu_sub_items.id
  blockType: 'text-h1' | 'text-h2' | 'text-h3' | 'text-body' | 'image-single' | 'image-double' | 'image-triple' | 'youtube' | 'button'
  content: TEXT (JSON 형태로 저장)
    - text 블록: { text: "내용" }
    - image 블록: { urls: ["url1", "url2", ...], captions: ["캡션1", ...] }
    - youtube 블록: { videoId: "유튜브ID", title: "제목" }
    - button 블록: { label: "버튼명", href: "링크" }
  sortOrder: INT (순서)
  createdAt, updatedAt
```

### Phase 4: 블록 에디터 서버 API
`server/db.ts` + `server/routers.ts`:
- `home.pageBlocks({ menuItemId?, menuSubItemId? })` — 공개 조회
- `cms.blocks.list` — 관리자 조회
- `cms.blocks.create` — 블록 생성
- `cms.blocks.update` — 블록 수정
- `cms.blocks.delete` — 블록 삭제
- `cms.blocks.reorder` — 순서 변경

### Phase 5: 블록 에디터 뷰어 UI
`DynamicPage.tsx`의 `EditorContent` 컴포넌트 실제 구현

### Phase 6: 블록 에디터 관리자 편집 UI
관리자 모드에서 `DynamicPage`에 편집 버튼 + 블록 추가/수정/삭제/순서변경 UI

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-17 | 작업 우선순위 규칙 추가 (현재 작업 완료 후 새 요청 진행) |
| 2026-04-17 | 성도 로그인 시스템 전면 통일 완료 |
| 2026-04-17 | 시간 슬롯 단위 DB 기반으로 통일 |
| 2026-04-17 | 브라우저 닫으면 자동 로그아웃 (세션 쿠키) 적용 |
| 2026-04-17 | MenuEditPanel InlineEditForm에 이미지 업로드 UI 완성 (pageType=image 선택 시 표시) |
| 2026-04-17 | trpc.admin → trpc.cms 오류 수정 (appRouter에 admin 키 없음, cms 사용해야 함) |
| 2026-04-17 | work-rules.md에 다음 작업 계획 상세 기록 (세션 재시작 대비) |
| 2026-04-17 | 이미지 전체화면 페이지 개선 완료 (라이트박스 추가, 꽉 찾기 이미지) |
| 2026-04-17 | 블록 에디터 DB 테이블 생성 (page_blocks) |
| 2026-04-17 | 블록 에디터 서버 API 완료 (home.pageBlocks, cms.blocks CRUD) |
| 2026-04-17 | 블록 에디터 뷰어 UI 완료 (H1/H2/H3/본문/이미지/유튜브/버튼 렌더링) |
| 2026-04-17 | 블록 에디터 관리자 편집 UI 완료 (블록 추가/수정/삭제/순서변경/숨김) |
