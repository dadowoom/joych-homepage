# 기쁨의교회 홈페이지 - 데이터베이스 설계 (ERD)

## 📋 목차
1. [전체 테이블 관계도](#전체-테이블-관계도)
2. [테이블 상세 설명](#테이블-상세-설명)
3. [주요 관계 (Foreign Key)](#주요-관계-foreign-key)
4. [인덱싱 전략](#인덱싱-전략)
5. [데이터 흐름](#데이터-흐름)

---

## 전체 테이블 관계도

```
┌──────────────────────────────────────────────────────────────────┐
│                        사용자 관리                                 │
├──────────────────────────────────────────────────────────────────┤
│ users (사용자)                                                    │
│ ├─ id (PK)                                                       │
│ ├─ openId (UNIQUE) ← Manus OAuth                               │
│ ├─ name, email                                                   │
│ ├─ role (user | admin)                                          │
│ ├─ createdAt, updatedAt, lastSignedIn                          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     네비게이션 & 메뉴                              │
├──────────────────────────────────────────────────────────────────┤
│ menus (1단 메뉴)                                                  │
│ ├─ id (PK)                                                       │
│ ├─ label, href                                                   │
│ ├─ sortOrder, isVisible                                         │
│ ├─ createdAt, updatedAt                                         │
│                                                                   │
│   ├─ 1:N ─────────────────────────────────────────────┐         │
│   │                                                    │         │
│   ▼                                                    ▼         │
│ menuItems (2단 메뉴)                    quickMenus (빠른 접근)  │
│ ├─ id (PK)                              ├─ id (PK)             │
│ ├─ menuId (FK)                          ├─ icon, label         │
│ ├─ label, href                          ├─ href                │
│ ├─ pageType (image|gallery|youtube)     ├─ sortOrder           │
│ ├─ pageImageUrl, playlistId             ├─ isVisible           │
│ ├─ sortOrder, isVisible                 └─ createdAt, updated  │
│                                                                   │
│   │                                                              │
│   │ 1:N                                                          │
│   ▼                                                              │
│ menuSubItems (3단 메뉴)                                          │
│ ├─ id (PK)                                                       │
│ ├─ menuItemId (FK)                                              │
│ ├─ label, href                                                   │
│ ├─ pageType, pageImageUrl, playlistId                           │
│ ├─ sortOrder, isVisible                                         │
└──────────────────────────────────────────────────────────────────┘
         │                                          │
         │ pageType=editor                         │ pageType=youtube
         │                                          │
         ▼                                          ▼
    ┌─────────────────┐              ┌──────────────────────────┐
    │  pageBlocks     │              │ youtubePlaylists         │
    │  (블록 에디터)   │              │ (플레이리스트)           │
    ├─────────────────┤              ├──────────────────────────┤
    │ id (PK)         │              │ id (PK)                  │
    │ menuItemId (FK) │              │ title, description       │
    │ menuSubItemId   │              │ createdAt, updatedAt     │
    │ blockType       │              │                          │
    │ content (JSON)  │              │ 1:N                      │
    │ sortOrder       │              │  │                       │
    │ isVisible       │              │  ▼                       │
    └─────────────────┘              │ youtubeVideos            │
                                     │ (영상 항목)              │
                                     ├──────────────────────────┤
                                     │ id (PK)                  │
                                     │ playlistId (FK)          │
                                     │ videoId (유튜브 ID)      │
                                     │ videoUrl (직접 URL)      │
                                     │ title, thumbnailUrl      │
                                     │ description              │
                                     │ sortOrder, isVisible     │
                                     └──────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    홈페이지 콘텐츠                                  │
├──────────────────────────────────────────────────────────────────┤
│ sections (섹션 마스터)                                            │
│ ├─ id (PK)                                                       │
│ ├─ type (section 타입 구분)                                      │
│ ├─ sortOrder, isVisible                                         │
│ ├─ title (관리자용)                                              │
│                                                                   │
│ heroSlides (히어로 슬라이드)                                      │
│ ├─ id (PK)                                                       │
│ ├─ videoUrl, posterUrl                                          │
│ ├─ yearLabel, mainTitle, subTitle                               │
│ ├─ bibleRef (성경 구절)                                          │
│ ├─ btn1Text, btn1Href, btn2Text, btn2Href                       │
│ ├─ sortOrder, isVisible                                         │
│                                                                   │
│ notices (공지사항)                                               │
│ ├─ id (PK)                                                       │
│ ├─ category (공지|행사|찬양)                                     │
│ ├─ title, content                                               │
│ ├─ thumbnailUrl                                                 │
│ ├─ isPublished, isPinned                                        │
│ ├─ authorId (FK → users)                                        │
│ ├─ createdAt, updatedAt                                         │
│                                                                   │
│ galleryItems (갤러리)                                            │
│ ├─ id (PK)                                                       │
│ ├─ imageUrl                                                      │
│ ├─ caption, gridSpan                                            │
│ ├─ sortOrder, isVisible                                         │
│                                                                   │
│ affiliates (관련 기관)                                           │
│ ├─ id (PK)                                                       │
│ ├─ icon, label, href                                            │
│ ├─ sortOrder, isVisible                                         │
│                                                                   │
│ siteSettings (교회 정보)                                         │
│ ├─ id (PK)                                                       │
│ ├─ settingKey (UNIQUE)                                          │
│ ├─ settingValue                                                 │
│ ├─ createdAt, updatedAt                                         │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    시설 예약 시스템                                │
├──────────────────────────────────────────────────────────────────┤
│ facilities (시설)                                                │
│ ├─ id (PK)                                                       │
│ ├─ name, description                                            │
│ ├─ capacity (수용 인원)                                          │
│ ├─ location (위치)                                              │
│ ├─ thumbnailUrl, imageUrls (JSON)                               │
│ ├─ sortOrder, isVisible                                         │
│                                                                   │
│   ├─ 1:N ─────────────────────────────────────────────┐         │
│   │                                                    │         │
│   ▼                                                    ▼         │
│ facilityHours (운영 시간)           facilityImages (사진)       │
│ ├─ id (PK)                          ├─ id (PK)                 │
│ ├─ facilityId (FK)                  ├─ facilityId (FK)         │
│ ├─ dayOfWeek (0-6)                  ├─ imageUrl                │
│ ├─ openTime, closeTime              ├─ caption                 │
│ ├─ isOpen (휴무 여부)                ├─ sortOrder               │
│                                      └─ createdAt               │
│                                                                   │
│   │                                                              │
│   │ 1:N                                                          │
│   ▼                                                              │
│ reservations (예약)                                              │
│ ├─ id (PK)                                                       │
│ ├─ facilityId (FK)                                              │
│ ├─ userId (FK → users)                                          │
│ ├─ reservationDate (예약 날짜)                                   │
│ ├─ startTime, endTime                                           │
│ ├─ purpose (사용 목적)                                           │
│ ├─ department (소속 부서)                                        │
│ ├─ attendees (사용 인원)                                         │
│ ├─ notes (추가 요청)                                             │
│ ├─ status (pending|approved|rejected|cancelled)                 │
│ ├─ adminComment (승인/거절 사유)                                 │
│ ├─ processedBy (FK → users)                                     │
│ ├─ processedAt                                                  │
│ ├─ createdAt, updatedAt                                         │
│                                                                   │
│   │                                                              │
│   │ 1:N                                                          │
│   ▼                                                              │
│ blockedDates (예약 불가 날짜)                                    │
│ ├─ id (PK)                                                       │
│ ├─ facilityId (FK)                                              │
│ ├─ blockedDate (날짜)                                            │
│ ├─ reason (차단 사유)                                            │
│ ├─ createdAt                                                    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      교회학교                                      │
├──────────────────────────────────────────────────────────────────┤
│ schoolDepartments (부서)                                         │
│ ├─ id (PK)                                                       │
│ ├─ name (부서명)                                                 │
│ ├─ category (church_school|youth)                               │
│ ├─ ageRange, worshipTime, worshipPlace                          │
│ ├─ description, educationGoals, prayerTopics                    │
│ ├─ staffInfo (JSON: [{role, name}])                             │
│ ├─ imageUrl                                                      │
│ ├─ sortOrder, isVisible                                         │
│                                                                   │
│   │                                                              │
│   │ 1:N                                                          │
│   ▼                                                              │
│ schoolPosts (게시글)                                             │
│ ├─ id (PK)                                                       │
│ ├─ departmentId (FK)                                            │
│ ├─ title, content                                               │
│ ├─ authorName, memberId (FK → members)                          │
│ ├─ viewCount                                                    │
│ ├─ isNotice, isVisible                                          │
│ ├─ createdAt, updatedAt                                         │
│                                                                   │
│   │                                                              │
│   │ 1:N                                                          │
│   ▼                                                              │
│ schoolPostFiles (첨부파일)                                       │
│ ├─ id (PK)                                                       │
│ ├─ postId (FK)                                                  │
│ ├─ fileName, fileUrl                                            │
│ ├─ fileSize, mimeType                                           │
│ ├─ createdAt                                                    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    기타 정보                                       │
├──────────────────────────────────────────────────────────────────┤
│ members (성도 정보)                                              │
│ ├─ id (PK)                                                       │
│ ├─ userId (FK → users)                                          │
│ ├─ name, phone, address                                         │
│ ├─ department (부서)                                             │
│ ├─ joinDate, role                                               │
│ ├─ createdAt, updatedAt                                         │
│                                                                   │
│ sermons (설교 목록)                                              │
│ ├─ id (PK)                                                       │
│ ├─ category (주일예배|수요예배|새벽기도)                         │
│ ├─ title, youtubeId                                             │
│ ├─ isPublished                                                  │
│ ├─ preachedAt                                                   │
│ ├─ createdAt, updatedAt                                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 테이블 상세 설명

### 1. users (사용자)
**용도**: Manus OAuth 기반 사용자 인증 및 권한 관리

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | 기본 키 |
| openId | VARCHAR(64) | Manus OAuth ID (UNIQUE) |
| name | TEXT | 사용자 이름 |
| email | VARCHAR(320) | 이메일 |
| loginMethod | VARCHAR(64) | 로그인 방법 (oauth/email 등) |
| role | ENUM | user 또는 admin |
| createdAt | TIMESTAMP | 생성 시각 |
| updatedAt | TIMESTAMP | 수정 시각 |
| lastSignedIn | TIMESTAMP | 마지막 로그인 시각 |

**인덱스**: openId (UNIQUE)

---

### 2. menus, menuItems, menuSubItems (네비게이션)
**용도**: 상단 GNB 3단 메뉴 구조

#### menus (1단)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | 기본 키 |
| label | VARCHAR(64) | 메뉴 이름 |
| href | VARCHAR(256) | 링크 URL (선택) |
| sortOrder | INT | 정렬 순서 |
| isVisible | BOOLEAN | 표시 여부 |
| createdAt | TIMESTAMP | 생성 시각 |
| updatedAt | TIMESTAMP | 수정 시각 |

#### menuItems (2단)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | 기본 키 |
| menuId | INT | 상위 메뉴 ID (FK) |
| label | VARCHAR(64) | 메뉴 이름 |
| href | VARCHAR(256) | 링크 URL |
| pageType | ENUM | image, gallery, board, youtube, editor |
| pageImageUrl | TEXT | 이미지 타입일 때 이미지 URL |
| playlistId | INT | youtube 타입일 때 플레이리스트 ID |
| sortOrder | INT | 정렬 순서 |
| isVisible | BOOLEAN | 표시 여부 |
| createdAt | TIMESTAMP | 생성 시각 |
| updatedAt | TIMESTAMP | 수정 시각 |

#### menuSubItems (3단)
menuItems와 동일한 구조 (menuItemId FK)

**인덱스**: 
- menus: sortOrder, isVisible
- menuItems: menuId, sortOrder, isVisible
- menuSubItems: menuItemId, sortOrder, isVisible

**주요 쿼리**:
```sql
-- GNB 표시 (공개)
SELECT * FROM menus WHERE isVisible=true ORDER BY sortOrder
  LEFT JOIN menuItems ON menuItems.menuId=menus.id AND menuItems.isVisible=true
  LEFT JOIN menuSubItems ON menuSubItems.menuItemId=menuItems.id AND menuSubItems.isVisible=true

-- 관리자용 (모두 포함)
SELECT * FROM menus ORDER BY sortOrder
  LEFT JOIN menuItems ON menuItems.menuId=menus.id
  LEFT JOIN menuSubItems ON menuSubItems.menuItemId=menuItems.id
```

---

### 3. facilities, reservations, blockedDates (시설 예약)
**용도**: 교회 시설 예약 시스템

#### facilities (시설)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | 기본 키 |
| name | VARCHAR(128) | 시설명 |
| description | TEXT | 설명 |
| capacity | INT | 수용 인원 |
| location | VARCHAR(256) | 위치 |
| thumbnailUrl | TEXT | 썸네일 이미지 |
| imageUrls | TEXT (JSON) | 사진 URL 배열 |
| sortOrder | INT | 정렬 순서 |
| isVisible | BOOLEAN | 표시 여부 |
| createdAt | TIMESTAMP | 생성 시각 |
| updatedAt | TIMESTAMP | 수정 시각 |

#### reservations (예약)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | 기본 키 |
| facilityId | INT | 시설 ID (FK) |
| userId | INT | 사용자 ID (FK) |
| reservationDate | DATE | 예약 날짜 |
| startTime | TIME | 시작 시간 |
| endTime | TIME | 종료 시간 |
| purpose | VARCHAR(256) | 사용 목적 |
| department | VARCHAR(128) | 소속 부서 |
| attendees | INT | 사용 인원 |
| notes | TEXT | 추가 요청사항 |
| status | ENUM | pending, approved, rejected, cancelled |
| adminComment | TEXT | 승인/거절 사유 |
| processedBy | INT | 처리 관리자 ID (FK) |
| processedAt | TIMESTAMP | 처리 시각 |
| createdAt | TIMESTAMP | 생성 시각 |
| updatedAt | TIMESTAMP | 수정 시각 |

#### blockedDates (예약 불가 날짜)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | 기본 키 |
| facilityId | INT | 시설 ID (FK) |
| blockedDate | DATE | 차단 날짜 |
| reason | VARCHAR(256) | 차단 사유 |
| createdAt | TIMESTAMP | 생성 시각 |

**인덱스**:
- reservations: (facilityId, reservationDate), (userId, status), createdAt
- blockedDates: (facilityId, blockedDate)

**주요 쿼리**:
```sql
-- 예약 가능 여부 확인
SELECT * FROM reservations 
WHERE facilityId=? AND reservationDate=? 
  AND status IN ('pending', 'approved')
  AND NOT (endTime <= ? OR startTime >= ?)

-- 차단된 날짜 확인
SELECT * FROM blockedDates WHERE facilityId=? AND blockedDate=?
```

---

### 4. pageBlocks (블록 에디터)
**용도**: 동적 페이지 콘텐츠 관리

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | 기본 키 |
| menuItemId | INT | 2단 메뉴 ID (FK, 선택) |
| menuSubItemId | INT | 3단 메뉴 ID (FK, 선택) |
| blockType | VARCHAR(32) | text-h1, text-h2, image-single, youtube, button 등 |
| content | TEXT (JSON) | 블록 내용 |
| sortOrder | INT | 페이지 내 순서 |
| isVisible | BOOLEAN | 표시 여부 |
| createdAt | TIMESTAMP | 생성 시각 |
| updatedAt | TIMESTAMP | 수정 시각 |

**content 예시**:
```json
// 텍스트 블록
{ "text": "제목 또는 본문" }

// 이미지 블록
{ "urls": ["url1", "url2"], "captions": ["캡션1", "캡션2"] }

// 유튜브 블록
{ "videoId": "dQw4w9WgXcQ", "title": "영상 제목" }

// 버튼 블록
{ "label": "더 알아보기", "href": "/about", "style": "primary" }
```

**인덱스**: (menuItemId, sortOrder), (menuSubItemId, sortOrder)

---

### 5. youtubePlaylists, youtubeVideos (유튜브)
**용도**: 예배 영상 및 설교 영상 관리

#### youtubePlaylists
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | 기본 키 |
| title | VARCHAR(128) | 플레이리스트 이름 |
| description | TEXT | 설명 |
| createdAt | TIMESTAMP | 생성 시각 |
| updatedAt | TIMESTAMP | 수정 시각 |

#### youtubeVideos
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | 기본 키 |
| playlistId | INT | 플레이리스트 ID (FK) |
| videoId | VARCHAR(32) | 유튜브 영상 ID (선택) |
| videoUrl | TEXT | 직접 영상 URL (mp4 등) (선택) |
| title | VARCHAR(256) | 영상 제목 |
| thumbnailUrl | TEXT | 썸네일 URL |
| description | TEXT | 설명 |
| sortOrder | INT | 정렬 순서 |
| isVisible | BOOLEAN | 표시 여부 |
| createdAt | TIMESTAMP | 생성 시각 |
| updatedAt | TIMESTAMP | 수정 시각 |

**인덱스**: (playlistId, sortOrder, isVisible)

**주의**: videoId와 videoUrl 중 하나만 사용 (유튜브 영상 또는 직접 URL)

---

### 6. notices (공지사항)
**용도**: 교회 소식 및 공지사항

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | 기본 키 |
| category | VARCHAR(32) | 공지, 행사, 찬양 등 |
| title | VARCHAR(256) | 제목 |
| content | TEXT | 본문 (긴 글 지원) |
| thumbnailUrl | TEXT | 썸네일 이미지 |
| isPublished | BOOLEAN | 게시 여부 |
| isPinned | BOOLEAN | 상단 고정 여부 |
| authorId | INT | 작성자 ID (FK → users) |
| createdAt | TIMESTAMP | 생성 시각 |
| updatedAt | TIMESTAMP | 수정 시각 |

**인덱스**: (isPublished, isPinned, createdAt DESC)

**페이지네이션**: createdAt 기반 커서 페이지네이션 사용

---

### 7. schoolDepartments, schoolPosts (교회학교)
**용도**: 교회학교 부서 및 게시판 관리

#### schoolDepartments
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | 기본 키 |
| name | VARCHAR(64) | 부서명 |
| category | ENUM | church_school, youth |
| ageRange | VARCHAR(64) | 대상 연령 |
| worshipTime | VARCHAR(128) | 예배 시간 |
| worshipPlace | VARCHAR(128) | 예배 장소 |
| description | TEXT | 부서 소개 |
| educationGoals | TEXT | 교육 목표 |
| prayerTopics | TEXT | 기도제목 |
| staffInfo | TEXT (JSON) | 섬기는 이들 |
| imageUrl | VARCHAR(512) | 대표 이미지 |
| sortOrder | INT | 정렬 순서 |
| isVisible | BOOLEAN | 표시 여부 |
| createdAt | TIMESTAMP | 생성 시각 |
| updatedAt | TIMESTAMP | 수정 시각 |

#### schoolPosts
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | 기본 키 |
| departmentId | INT | 부서 ID (FK) |
| title | VARCHAR(256) | 제목 |
| content | TEXT | 내용 |
| authorName | VARCHAR(64) | 작성자 이름 |
| memberId | INT | 작성자 ID (FK → members) |
| viewCount | INT | 조회수 |
| isNotice | BOOLEAN | 공지 여부 |
| isVisible | BOOLEAN | 표시 여부 |
| createdAt | TIMESTAMP | 생성 시각 |
| updatedAt | TIMESTAMP | 수정 시각 |

**인덱스**: (departmentId, isNotice, createdAt DESC)

---

## 주요 관계 (Foreign Key)

| 테이블 | FK 컬럼 | 참조 테이블 | 참조 컬럼 | 설명 |
|--------|---------|-----------|---------|------|
| menuItems | menuId | menus | id | 1단 메뉴 |
| menuSubItems | menuItemId | menuItems | id | 2단 메뉴 |
| menuItems | playlistId | youtubePlaylists | id | 유튜브 플레이리스트 |
| menuSubItems | playlistId | youtubePlaylists | id | 유튜브 플레이리스트 |
| pageBlocks | menuItemId | menuItems | id | 페이지 콘텐츠 |
| pageBlocks | menuSubItemId | menuSubItems | id | 페이지 콘텐츠 |
| youtubeVideos | playlistId | youtubePlaylists | id | 영상 목록 |
| reservations | facilityId | facilities | id | 시설 |
| reservations | userId | users | id | 사용자 |
| reservations | processedBy | users | id | 처리 관리자 |
| blockedDates | facilityId | facilities | id | 시설 |
| notices | authorId | users | id | 작성자 |
| schoolPosts | departmentId | schoolDepartments | id | 부서 |
| schoolPosts | memberId | members | id | 작성자 |
| schoolPostFiles | postId | schoolPosts | id | 게시글 |

---

## 인덱싱 전략

### 성능 최적화 인덱스

```sql
-- 네비게이션
CREATE INDEX idx_menus_visible_sort ON menus(isVisible, sortOrder);
CREATE INDEX idx_menu_items_menu_id ON menuItems(menuId, sortOrder);
CREATE INDEX idx_menu_sub_items_item_id ON menuSubItems(menuItemId, sortOrder);

-- 시설 예약
CREATE INDEX idx_reservations_facility_date ON reservations(facilityId, reservationDate);
CREATE INDEX idx_reservations_user_status ON reservations(userId, status);
CREATE INDEX idx_blocked_dates_facility ON blockedDates(facilityId, blockedDate);

-- 블록 에디터
CREATE INDEX idx_page_blocks_menu_item ON pageBlocks(menuItemId, sortOrder);
CREATE INDEX idx_page_blocks_menu_sub_item ON pageBlocks(menuSubItemId, sortOrder);

-- 유튜브
CREATE INDEX idx_youtube_videos_playlist ON youtubeVideos(playlistId, sortOrder);

-- 공지사항 (페이지네이션)
CREATE INDEX idx_notices_published_created ON notices(isPublished, createdAt DESC);

-- 교회학교
CREATE INDEX idx_school_posts_department ON schoolPosts(departmentId, createdAt DESC);
```

---

## 데이터 흐름

### 1. 방문자 홈페이지 접속
```
1. menus (isVisible=true) 조회 → GNB 표시
2. heroSlides (isVisible=true) 조회 → 히어로 슬라이드
3. notices (isPublished=true) 조회 → 공지사항
4. facilities (isVisible=true) 조회 → 시설 목록
5. youtubePlaylists 조회 → 예배 영상
```

### 2. 시설 예약 프로세스
```
1. facilities 조회 → 시설 선택
2. blockedDates 조회 → 예약 불가 날짜 확인
3. reservations 조회 → 기존 예약 확인 (시간 충돌)
4. reservations 생성 (status=pending)
5. 관리자가 reservations 업데이트 (status=approved/rejected)
```

### 3. 메뉴 편집 (관리자)
```
1. menus, menuItems, menuSubItems 조회 (모두 포함)
2. menus 업데이트 (isVisible 토글)
3. menuItems 업데이트 (isVisible 토글)
4. menuSubItems 업데이트 (isVisible 토글)
5. home.menus 캐시 무효화 → GNB 즉시 반영
```

### 4. 블록 에디터 (관리자)
```
1. menuItems 또는 menuSubItems 조회
2. pageBlocks 조회 (menuItemId 또는 menuSubItemId)
3. pageBlocks 생성/수정/삭제
4. 공개 페이지에서 pageBlocks 조회 (isVisible=true, sortOrder)
```

---

## 데이터 보존 정책

| 테이블 | 보존 기간 | 정책 |
|--------|---------|------|
| users | 무제한 | 로그인 기록 유지 |
| reservations | 2년 | 과거 예약 기록 보존 |
| notices | 무제한 | 교회 역사 기록 |
| schoolPosts | 무제한 | 교육 자료 보존 |
| logs | 3개월 | 자동 삭제 |

---

## 참고 문서
- [시스템 아키텍처](./ARCHITECTURE.md)
- [API 명세서](./API_SPEC.md)
- [배포 가이드](./DEPLOYMENT.md)
