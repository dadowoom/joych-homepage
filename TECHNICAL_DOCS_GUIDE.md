# 기쁨의교회 홈페이지 - 기술 문서 가이드

## 📚 문서 구성

이 프로젝트의 기술 문서는 다음 4개의 주요 문서로 구성되어 있습니다.

### 1. **ARCHITECTURE.md** - 시스템 아키텍처
전체 시스템의 구조, 기술 스택, 데이터 흐름을 설명합니다.

**주요 내용**:
- 클라이언트-서버-데이터베이스 구조
- 기술 스택 (React, Express, MySQL, tRPC)
- OAuth 2.0 인증 흐름
- 배포 구조 (Manus 호스팅 vs 외부 서버)
- 보안 고려사항

**대상**: 시스템 전체를 이해하고 싶은 개발자, 아키텍처 검토자

---

### 2. **DATABASE_ERD.md** - 데이터베이스 설계
전체 데이터베이스 테이블 관계도 및 상세 설명입니다.

**주요 내용**:
- 전체 테이블 관계도 (ERD)
- 각 테이블의 컬럼 설명
- Foreign Key 관계
- 인덱싱 전략
- 데이터 흐름 (사용자 여정별)

**대상**: 데이터베이스 설계자, 백엔드 개발자, DBA

---

### 3. **API_SPEC.md** - API 명세서
모든 tRPC 엔드포인트의 입출력 명세입니다.

**주요 내용**:
- 공개 API (인증 불필요)
- 사용자 API (로그인 필요)
- 관리자 API (admin 권한 필요)
- 에러 처리 방식
- 캐싱 전략

**대상**: 프론트엔드 개발자, API 사용자, 모바일 앱 개발자

---

### 4. **README.md** - 프로젝트 개요
프로젝트 소개, 설치, 실행 방법입니다.

**주요 내용**:
- 프로젝트 개요
- 설치 및 실행 방법
- 개발 흐름
- 배포 방법

**대상**: 새로운 개발자, 프로젝트 관리자

---

## 🎯 문서 사용 시나리오

### 시나리오 1: 새로운 기능 추가
1. **ARCHITECTURE.md** → 전체 시스템 이해
2. **DATABASE_ERD.md** → 데이터 구조 파악
3. **API_SPEC.md** → 기존 API 패턴 확인
4. 기능 구현

### 시나리오 2: 버그 수정
1. **API_SPEC.md** → 해당 API 명세 확인
2. **DATABASE_ERD.md** → 데이터 흐름 추적
3. 원인 파악 및 수정

### 시나리오 3: 외부 서버로 이전
1. **ARCHITECTURE.md** → 배포 구조 확인
2. **DEPLOYMENT.md** → 배포 가이드 참고
3. 환경 설정 및 마이그레이션

### 시나리오 4: 성능 최적화
1. **ARCHITECTURE.md** → 성능 최적화 섹션
2. **DATABASE_ERD.md** → 인덱싱 전략
3. **API_SPEC.md** → 캐싱 전략

---

## 📖 각 문서별 상세 내용

### ARCHITECTURE.md 상세 구조

```
1. 전체 시스템 구조
   ├─ 클라이언트 (React)
   ├─ 백엔드 (Express)
   ├─ 데이터베이스 (MySQL)
   └─ 외부 서비스 (S3, OAuth, LLM)

2. 기술 스택
   ├─ 프론트엔드 (React 19, Tailwind 4, TypeScript)
   ├─ 백엔드 (Express 4, tRPC 11, Drizzle ORM)
   └─ 데이터베이스 (MySQL / TiDB)

3. 데이터베이스 설계
   ├─ 테이블 분류 (사용자, 메뉴, 콘텐츠, 예약, 교회학교)
   └─ 관계도

4. API 구조
   ├─ tRPC 라우터 계층
   ├─ 공개/사용자/관리자 API
   └─ 주요 엔드포인트

5. 인증 및 권한
   ├─ OAuth 2.0 흐름
   ├─ 권한 체계 (user/admin)
   └─ 보호된 프로시저

6. 배포 구조
   ├─ 개발 환경
   ├─ Manus 호스팅
   └─ 외부 서버 이전

7. 보안 고려사항
   ├─ 구현된 보안 기능
   ├─ 환경변수 보안
   └─ 모니터링 및 로깅

8. 성능 최적화
   ├─ 데이터베이스
   ├─ 프론트엔드
   └─ 백엔드

9. 확장성
   ├─ 새로운 기능 추가 흐름
   └─ 모듈화 구조
```

---

### DATABASE_ERD.md 상세 구조

```
1. 전체 테이블 관계도 (ERD)
   ├─ 사용자 관리 (users)
   ├─ 네비게이션 (menus, menuItems, menuSubItems)
   ├─ 홈페이지 콘텐츠 (heroSlides, notices, gallery)
   ├─ 시설 예약 (facilities, reservations, blockedDates)
   ├─ 교회학교 (schoolDepartments, schoolPosts)
   └─ 유튜브 (youtubePlaylists, youtubeVideos)

2. 테이블 상세 설명
   ├─ users: 사용자 정보
   ├─ menus/menuItems/menuSubItems: 3단 메뉴
   ├─ facilities/reservations/blockedDates: 시설 예약
   ├─ pageBlocks: 블록 에디터
   ├─ youtubePlaylists/youtubeVideos: 영상 관리
   ├─ notices: 공지사항
   └─ schoolDepartments/schoolPosts: 교회학교

3. 주요 관계 (Foreign Key)
   └─ 모든 FK 관계 테이블

4. 인덱싱 전략
   ├─ 성능 최적화 인덱스
   └─ 페이지네이션 인덱스

5. 데이터 흐름
   ├─ 방문자 홈페이지 접속
   ├─ 시설 예약 프로세스
   ├─ 메뉴 편집 (관리자)
   └─ 블록 에디터 (관리자)

6. 데이터 보존 정책
   └─ 각 테이블별 보존 기간
```

---

### API_SPEC.md 상세 구조

```
1. 개요
   ├─ 기술 스택 (tRPC)
   ├─ 호출 방식 (React, cURL)
   └─ 엔드포인트

2. 인증
   ├─ OAuth 2.0 로그인 흐름
   ├─ 로그아웃
   └─ 현재 사용자 정보

3. 공개 API (Public)
   ├─ 네비게이션 & 메뉴
   │  ├─ home.menus
   │  ├─ home.menuItemByHref
   │  └─ ...
   ├─ 홈페이지 콘텐츠
   │  ├─ home.heroSlides
   │  ├─ home.notices
   │  ├─ home.gallery
   │  └─ ...
   ├─ 시설 정보
   │  ├─ home.facilities
   │  ├─ home.facility
   │  ├─ home.facilityReservationsByDate
   │  └─ ...
   └─ 유튜브 영상
      ├─ youtube.getPlaylists
      └─ youtube.getVideos

4. 사용자 API (Protected)
   ├─ 인증
   │  ├─ auth.me
   │  └─ auth.logout
   ├─ 예약 관리
   │  ├─ home.myReservations
   │  └─ members.updateMyInfo
   └─ ...

5. 관리자 API (Admin)
   ├─ 메뉴 관리
   │  ├─ cms.menus.list
   │  ├─ cms.menus.create
   │  ├─ cms.menus.update
   │  ├─ cms.menus.delete
   │  ├─ cms.menus.createItem
   │  ├─ cms.menus.updateItem
   │  ├─ cms.menus.deleteItem
   │  └─ cms.menus.reorder
   ├─ 블록 에디터
   │  ├─ cms.blocks.list
   │  ├─ cms.blocks.create
   │  ├─ cms.blocks.update
   │  ├─ cms.blocks.delete
   │  └─ ...
   ├─ 시설 관리
   │  ├─ cms.facilities.list
   │  ├─ cms.facilities.create
   │  ├─ cms.facilities.update
   │  ├─ cms.facilities.addBlockedDate
   │  └─ ...
   ├─ 예약 관리
   │  ├─ cms.reservations.list
   │  ├─ cms.reservations.approve
   │  ├─ cms.reservations.reject
   │  └─ ...
   ├─ 파일 업로드
   │  └─ cms.upload.presignedUrl
   ├─ 유튜브 관리
   │  ├─ youtube.addVideo
   │  ├─ youtube.updateVideo
   │  └─ youtube.deleteVideo
   └─ 시스템
      └─ system.notifyOwner

6. 에러 처리
   ├─ 에러 응답 형식
   ├─ 주요 에러 코드
   └─ 클라이언트에서 에러 처리

7. 배치 요청
   └─ 여러 요청 동시 처리

8. 캐싱 전략
   └─ React Query 캐싱
```

---

## 🔄 문서 업데이트 규칙

### 언제 업데이트하나?

1. **새로운 테이블 추가** → DATABASE_ERD.md 업데이트
2. **새로운 API 엔드포인트 추가** → API_SPEC.md 업데이트
3. **기술 스택 변경** → ARCHITECTURE.md 업데이트
4. **배포 방식 변경** → ARCHITECTURE.md의 배포 구조 업데이트

### 어떻게 업데이트하나?

1. 해당 문서 파일 열기
2. 변경 사항 추가
3. 관련 섹션 업데이트
4. 목차 업데이트 (필요시)
5. 예제 코드 검증
6. 체크포인트 저장

---

## 📝 문서 작성 규칙

### 마크다운 형식
- 제목: `#`, `##`, `###` 사용
- 코드 블록: ` ``` ` 사용
- 테이블: `|` 사용
- 링크: `[텍스트](URL)` 형식

### 예제 코드
- 모든 API 명세에는 사용 예제 포함
- 타입스크립트 타입 정의 포함
- 에러 처리 예제 포함

### 다이어그램
- ASCII 아트 또는 텍스트 기반 다이어그램
- 복잡한 구조는 여러 단계로 분해

---

## 🚀 빠른 참조

### 자주 찾는 정보

#### Q1: 새로운 기능을 추가하려면?
**A**: ARCHITECTURE.md → DATABASE_ERD.md → API_SPEC.md 순서로 읽고, 기능 추가 흐름 섹션 참고

#### Q2: 특정 API의 입출력 형식은?
**A**: API_SPEC.md에서 해당 API 검색

#### Q3: 데이터베이스 테이블 관계는?
**A**: DATABASE_ERD.md의 ERD 섹션 참고

#### Q4: 시설 예약 프로세스는?
**A**: DATABASE_ERD.md의 "데이터 흐름" → "시설 예약 프로세스" 참고

#### Q5: 외부 서버로 이전하려면?
**A**: ARCHITECTURE.md의 "배포 구조" 및 DEPLOYMENT.md 참고

#### Q6: 관리자 API는 어디서?
**A**: API_SPEC.md의 "관리자 API (Admin)" 섹션

#### Q7: 에러 처리는 어떻게?
**A**: API_SPEC.md의 "에러 처리" 섹션

---

## 📊 문서 통계

| 문서 | 섹션 수 | 테이블 수 | 코드 예제 |
|------|--------|---------|---------|
| ARCHITECTURE.md | 9 | 3 | 5+ |
| DATABASE_ERD.md | 8 | 15+ | 3+ |
| API_SPEC.md | 8 | 20+ | 10+ |
| **합계** | **25** | **38+** | **18+** |

---

## 🔗 관련 문서

- [README.md](./README.md) - 프로젝트 개요
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 배포 가이드
- [HANDOVER.md](./HANDOVER.md) - 인수인계 문서
- [ENV_SETUP.md](./ENV_SETUP.md) - 환경 설정

---

## ✅ 체크리스트

기술 문서를 처음 읽을 때 확인하세요:

- [ ] ARCHITECTURE.md에서 전체 시스템 구조 이해
- [ ] DATABASE_ERD.md에서 데이터 모델 이해
- [ ] API_SPEC.md에서 주요 API 파악
- [ ] 각 문서의 예제 코드 실행 및 검증
- [ ] 질문 사항 정리 및 팀에 공유

---

## 📞 문서 관련 문의

문서에 오류나 누락이 있으면:
1. 해당 문서 파일 확인
2. 수정 사항 정리
3. 팀에 공유 및 검토
4. 체크포인트 저장

---

**마지막 업데이트**: 2026-04-21
**버전**: 1.0
**상태**: 완성
