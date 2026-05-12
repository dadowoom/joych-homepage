# 선교보고 운영 기능 구현 계획서

작성일: 2026-05-12  
작업 브랜치: `feature/mission-reports-cms`  
복구 지점: `backup/pre-mission-report-20260512`, `backup-2026-05-12-pre-mission-report`

## 1. 핵심 원칙

기쁨의교회 관계자 측에서 현재 디자인과 UI에 만족한다고 확인했으므로, 이번 작업은 화면 리디자인이 아니다.

변경 금지:

- `/mission` 선교보고 목록의 카드 구도, 배치, 색상, 타이포그래피
- `/mission/:id` 선교보고 상세의 구도, 배치, 색상, 타이포그래피
- 기존 버튼/카드/배너의 시각 스타일
- 전체 홈페이지 톤

허용되는 변경:

- 목업 데이터를 DB 데이터로 교체
- 권한 있는 작성자에게만 글쓰기/수정 버튼 노출
- 기존 스타일에 맞춘 최소한의 작성/관리 화면 추가
- 서버 권한 검사, 승인 흐름, 사진 업로드, 저장 기능 추가

## 2. 목표

선교보고를 운영 가능한 실제 기능으로 만든다.

- 관리자가 특정 성도에게 선교보고 작성 권한을 부여/회수할 수 있다.
- 권한 있는 작성자는 선교보고 글을 작성하고 사진을 올릴 수 있다.
- 작성된 글은 바로 공개하지 않고 `검토 대기` 상태가 된다.
- 관리자가 승인한 글만 공개 홈페이지에 노출된다.
- 기존 `/mission` 목록과 `/mission/:id` 상세 UI는 현재 모습 그대로 유지한다.

## 3. 권한 모델

| 사용자 | 가능 작업 |
| --- | --- |
| 방문자 | 공개 승인된 선교보고 보기 |
| 일반 성도 | 공개 승인된 선교보고 보기 |
| 선교보고 작성자 | 본인에게 허용된 선교사/지역의 보고서 작성, 본인 글 수정 요청 |
| 관리자 | 작성자 권한 부여/회수, 전체 보고서 작성/수정/승인/거절/삭제 |

중요: 버튼을 숨기는 것만으로는 보안이 아니므로, 서버 API에서 반드시 권한을 다시 검사한다.

## 4. 데이터 구조 초안

### 4.1 선교사/사역지

`missionaries`

- `id`
- `name`
- `continent`
- `region`
- `profileImage`
- `description`
- `isActive`
- `sortOrder`

### 4.2 작성 권한

`mission_report_authors`

- `id`
- `memberId`
- `missionaryId`
- `canWrite`
- `createdBy`
- `createdAt`

한 성도가 여러 선교사/지역을 담당할 수 있고, 한 선교사/지역에 여러 작성자가 배정될 수 있다.

### 4.3 선교보고

`mission_reports`

- `id`
- `missionaryId`
- `authorMemberId`
- `title`
- `summary`
- `content`
- `thumbnailUrl`
- `reportDate`
- `status`: `draft`, `pending`, `published`, `rejected`
- `publishedAt`
- `reviewedBy`
- `reviewedAt`
- `reviewComment`

### 4.4 사진

`mission_report_images`

- `id`
- `reportId`
- `imageUrl`
- `caption`
- `sortOrder`

### 4.5 기도제목

`mission_report_prayer_topics`

- `id`
- `reportId`
- `content`
- `sortOrder`

## 5. 화면 흐름

### 5.1 공개 목록 `/mission`

현재 카드 UI를 유지한다.

- 기존 `MOCK_REPORTS` 대신 `mission.reports` API 사용
- `published` 상태만 표시
- 대륙/선교사 필터 기존 동작 유지
- 카드 클릭 시 기존처럼 `/mission/:id` 이동

### 5.2 공개 상세 `/mission/:id`

현재 상세 UI를 유지한다.

- DB 보고서 상세 조회
- 대표 사진, 본문, 사진, 기도제목 표시
- 이전/다음 글도 DB 기준

### 5.3 작성자 글쓰기

권한 있는 성도에게만 노출한다.

- 제목
- 보고 날짜
- 담당 선교사 선택
- 요약
- 본문
- 대표 사진 업로드
- 추가 사진 업로드
- 기도제목 여러 개
- 임시저장 또는 검토 요청

### 5.4 관리자 CMS

기존 관리자 CMS 안에 `선교보고` 탭을 추가한다.

- 선교사/사역지 관리
- 작성자 권한 관리
- 보고서 목록
- 대기 글 승인/거절
- 공개 글 수정/비공개 처리

## 6. 구현 순서

1. DB 스키마 추가
2. 서버 DB 함수 추가
3. tRPC 라우터 추가
4. 공개 `/mission` 목록/상세를 DB 기반으로 교체
5. 작성자용 작성 화면 추가
6. 관리자 CMS 탭 추가
7. 테스트/빌드/실제 동작 검증

## 7. 주의사항

- 기존 UI 리디자인 금지
- mock 데이터는 최종적으로 운영 화면에서 제거
- 업로드 파일은 기존 CMS 업로드 보안 정책과 같은 MIME/용량 제한 적용
- 성도 개인정보는 공개 API에 노출하지 않음
- 작성 권한은 프론트와 서버에서 이중 확인

## 8. 1차 구현 기록

작성일: 2026-05-12

### 완료

- 선교보고 DB 스키마 추가
  - `missionaries`
  - `mission_report_authors`
  - `mission_reports`
  - `mission_report_images`
  - `mission_report_prayer_topics`
- 마이그레이션 생성
  - `drizzle/0009_white_eddie_brock.sql`
- 공개/작성자 tRPC 라우터 추가
  - `mission.missionaries`
  - `mission.reports`
  - `mission.report`
  - `mission.myAuthorGrants`
  - `mission.myReports`
  - `mission.createReport`
  - `mission.updateReport`
  - `mission.uploadImage`
- 관리자 CMS 라우터 추가
  - 선교사/사역지 추가/수정
  - 작성자 권한 부여/활성/비활성
  - 선교보고 승인/반려
- 기존 `/mission` 목록 UI를 DB API 기반으로 연결
- 기존 `/mission/:id` 상세 UI를 DB API 기반으로 연결
- 작성자 전용 `/mission/write`, `/mission/edit/:id` 화면 추가
- 관리자 `선교보고 관리` 탭 추가

### 검증

| 항목 | 결과 |
| --- | --- |
| TypeScript 타입 검사 | 통과 |
| 기존 테스트 | 3개 파일, 52개 테스트 통과 |
| 프론트 production build | 통과 |
| 서버 esbuild 번들 | 통과 |

### 운영 반영 전 필수

- DB 마이그레이션 적용 필요
- 최소 1개 이상의 선교사/사역지 등록 필요
- 관리자가 작성 성도에게 작성 권한을 부여해야 함
- 공개 화면에 표시하려면 보고서 상태가 `published`여야 함
