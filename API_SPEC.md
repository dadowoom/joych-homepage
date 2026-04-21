# 기쁨의교회 홈페이지 - API 명세서

## 📋 목차
1. [개요](#개요)
2. [인증](#인증)
3. [공개 API (Public)](#공개-api-public)
4. [사용자 API (Protected)](#사용자-api-protected)
5. [관리자 API (Admin)](#관리자-api-admin)
6. [에러 처리](#에러-처리)

---

## 개요

### 기술 스택
- **프로토콜**: tRPC (RPC 기반, JSON 직렬화)
- **엔드포인트**: `/api/trpc`
- **인증**: Manus OAuth 2.0 + 세션 쿠키
- **데이터 포맷**: JSON + Superjson (Date, Map 등 복잡한 타입 지원)

### 호출 방식

#### 브라우저 (React)
```typescript
import { trpc } from "@/lib/trpc";

// 쿼리 (조회)
const { data, isLoading } = trpc.home.menus.useQuery();

// 뮤테이션 (생성/수정/삭제)
const mutation = trpc.cms.menus.create.useMutation({
  onSuccess: () => { /* 성공 처리 */ },
  onError: (error) => { /* 에러 처리 */ }
});
mutation.mutate({ label: "새 메뉴" });
```

#### cURL
```bash
# 쿼리
curl -X POST http://localhost:3000/api/trpc/home.menus \
  -H "Content-Type: application/json" \
  -d '{}'

# 뮤테이션
curl -X POST http://localhost:3000/api/trpc/cms.menus.create \
  -H "Content-Type: application/json" \
  -d '{"label":"새 메뉴"}'
```

---

## 인증

### OAuth 2.0 로그인 흐름

#### 1. 로그인 URL 생성
```typescript
import { getLoginUrl } from "@/const";

const loginUrl = getLoginUrl("/admin"); // 로그인 후 리다이렉트 경로
window.location.href = loginUrl;
```

#### 2. Manus OAuth 포털에서 인증
- 사용자가 이메일/소셜 로그인 수행
- 콜백: `/api/oauth/callback?code=...&state=...`

#### 3. 세션 쿠키 발급
- 백엔드에서 토큰 교환 및 사용자 정보 조회
- httpOnly 쿠키로 세션 저장
- 클라이언트로 리다이렉트

#### 4. 이후 모든 요청에 쿠키 자동 포함
```typescript
// tRPC 클라이언트 설정
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include", // 쿠키 자동 포함
        });
      },
    }),
  ],
});
```

### 로그아웃
```typescript
const logoutMutation = trpc.auth.logout.useMutation();
logoutMutation.mutate(); // 세션 쿠키 삭제
```

### 현재 사용자 정보
```typescript
const { data: user } = trpc.auth.me.useQuery();
// user: { id, openId, name, email, role, ... } | null
```

---

## 공개 API (Public)

모든 사용자가 인증 없이 접근 가능한 API입니다.

### 네비게이션 & 메뉴

#### `home.menus` (GET)
**설명**: 상단 GNB 메뉴 조회 (isVisible=true만)

**응답**:
```typescript
{
  id: number;
  label: string;
  href?: string;
  sortOrder: number;
  isVisible: boolean;
  items: {
    id: number;
    label: string;
    href?: string;
    pageType: "image" | "gallery" | "board" | "youtube" | "editor";
    pageImageUrl?: string;
    playlistId?: number;
    sortOrder: number;
    isVisible: boolean;
    subItems: {
      id: number;
      label: string;
      href?: string;
      pageType: string;
      pageImageUrl?: string;
      playlistId?: number;
      sortOrder: number;
      isVisible: boolean;
    }[];
  }[];
}[]
```

**사용 예**:
```typescript
const { data: menus } = trpc.home.menus.useQuery();
```

---

#### `home.menuItemByHref` (GET)
**설명**: href로 메뉴 항목 조회

**입력**:
```typescript
{ href: string }
```

**응답**:
```typescript
{
  id: number;
  label: string;
  href: string;
  pageType: string;
  pageImageUrl?: string;
  playlistId?: number;
}
```

---

### 홈페이지 콘텐츠

#### `home.heroSlides` (GET)
**설명**: 히어로 슬라이드 조회

**응답**:
```typescript
{
  id: number;
  videoUrl?: string;
  posterUrl?: string;
  yearLabel?: string;
  mainTitle?: string;
  subTitle?: string;
  bibleRef?: string;
  btn1Text?: string;
  btn1Href?: string;
  btn2Text?: string;
  btn2Href?: string;
  sortOrder: number;
}[]
```

---

#### `home.notices` (GET)
**설명**: 최신 공지사항 5개 조회

**응답**:
```typescript
{
  id: number;
  category: string;
  title: string;
  content: string;
  thumbnailUrl?: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}[]
```

---

#### `home.gallery` (GET)
**설명**: 갤러리 사진 조회

**응답**:
```typescript
{
  id: number;
  imageUrl: string;
  caption?: string;
  gridSpan: string;
  sortOrder: number;
}[]
```

---

#### `home.affiliates` (GET)
**설명**: 관련 기관 링크 조회

**응답**:
```typescript
{
  id: number;
  icon: string;
  label: string;
  href?: string;
  sortOrder: number;
}[]
```

---

### 시설 정보

#### `home.facilities` (GET)
**설명**: 시설 목록 조회

**응답**:
```typescript
{
  id: number;
  name: string;
  description?: string;
  capacity: number;
  location?: string;
  thumbnailUrl?: string;
  imageUrls: string[];
  sortOrder: number;
}[]
```

---

#### `home.facility` (GET)
**설명**: 특정 시설 상세 정보

**입력**:
```typescript
{ id: number }
```

**응답**:
```typescript
{
  id: number;
  name: string;
  description?: string;
  capacity: number;
  location?: string;
  thumbnailUrl?: string;
  imageUrls: string[];
  hours: {
    dayOfWeek: number; // 0=일요일, 6=토요일
    openTime: string; // "09:00"
    closeTime: string; // "18:00"
    isOpen: boolean;
  }[];
}
```

---

#### `home.facilityReservationsByDate` (GET)
**설명**: 특정 시설의 특정 날짜 예약 현황

**입력**:
```typescript
{ facilityId: number; date: Date }
```

**응답**:
```typescript
{
  id: number;
  startTime: string;
  endTime: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
}[]
```

---

#### `home.facilityBlockedDates` (GET)
**설명**: 시설 예약 불가 날짜

**입력**:
```typescript
{ facilityId: number }
```

**응답**:
```typescript
{
  id: number;
  blockedDate: Date;
  reason?: string;
}[]
```

---

### 유튜브 영상

#### `youtube.getPlaylists` (GET)
**설명**: 유튜브 플레이리스트 목록

**응답**:
```typescript
{
  id: number;
  title: string;
  description?: string;
}[]
```

---

#### `youtube.getVideos` (GET)
**설명**: 플레이리스트의 영상 목록

**입력**:
```typescript
{ playlistId: number }
```

**응답**:
```typescript
{
  id: number;
  videoId?: string; // 유튜브 영상 ID
  videoUrl?: string; // 직접 URL (mp4 등)
  title: string;
  thumbnailUrl?: string;
  description?: string;
  sortOrder: number;
}[]
```

---

### 페이지 콘텐츠

#### `home.pageBlocks` (GET)
**설명**: 동적 페이지 블록 조회

**입력**:
```typescript
{ menuItemId?: number; menuSubItemId?: number }
```

**응답**:
```typescript
{
  id: number;
  blockType: string; // "text-h1", "image-single", "youtube", etc.
  content: any; // JSON 형식 (blockType에 따라 다름)
  sortOrder: number;
}[]
```

---

## 사용자 API (Protected)

로그인한 모든 사용자가 접근 가능한 API입니다.

### 인증

#### `auth.me` (GET)
**설명**: 현재 로그인한 사용자 정보

**응답**:
```typescript
{
  id: number;
  openId: string;
  name?: string;
  email?: string;
  role: "user" | "admin";
  createdAt: Date;
  lastSignedIn: Date;
} | null
```

---

#### `auth.logout` (POST)
**설명**: 로그아웃 (세션 쿠키 삭제)

**응답**:
```typescript
{ success: boolean }
```

---

### 예약 관리

#### `home.myReservations` (GET)
**설명**: 현재 사용자의 예약 목록

**응답**:
```typescript
{
  id: number;
  facilityId: number;
  facilityName: string;
  reservationDate: Date;
  startTime: string;
  endTime: string;
  purpose: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  adminComment?: string;
  createdAt: Date;
}[]
```

---

#### `members.updateMyInfo` (POST)
**설명**: 내 정보 수정

**입력**:
```typescript
{
  name?: string;
  phone?: string;
  address?: string;
  department?: string;
}
```

**응답**:
```typescript
{ success: boolean }
```

---

## 관리자 API (Admin)

admin 역할을 가진 사용자만 접근 가능한 API입니다.

### 메뉴 관리

#### `cms.menus.list` (GET)
**설명**: 모든 메뉴 조회 (비공개 포함)

**응답**: menus 구조와 동일 (isVisible 상관없이 모두 포함)

---

#### `cms.menus.create` (POST)
**설명**: 1단 메뉴 생성

**입력**:
```typescript
{
  label: string;
  href?: string;
  sortOrder?: number;
}
```

**응답**:
```typescript
{ insertId: number }
```

---

#### `cms.menus.update` (POST)
**설명**: 메뉴 수정

**입력**:
```typescript
{
  id: number;
  label?: string;
  href?: string;
  sortOrder?: number;
  isVisible?: boolean;
}
```

---

#### `cms.menus.delete` (POST)
**설명**: 메뉴 삭제 (하위 메뉴 포함)

**입력**:
```typescript
{ id: number }
```

---

#### `cms.menus.createItem` (POST)
**설명**: 2단 메뉴 생성

**입력**:
```typescript
{
  menuId: number;
  label: string;
  href?: string;
  sortOrder?: number;
  pageType?: "image" | "gallery" | "board" | "youtube" | "editor";
  pageImageUrl?: string;
}
```

**응답**:
```typescript
{ insertId: number }
```

---

#### `cms.menus.updateItem` (POST)
**설명**: 2단 메뉴 수정

**입력**:
```typescript
{
  id: number;
  label?: string;
  href?: string;
  sortOrder?: number;
  isVisible?: boolean;
  pageType?: string;
  pageImageUrl?: string;
}
```

---

#### `cms.menus.deleteItem` (POST)
**설명**: 2단 메뉴 삭제 (3단 메뉴 포함)

**입력**:
```typescript
{ id: number }
```

---

#### `cms.menus.reorder` (POST)
**설명**: 1단 메뉴 순서 변경

**입력**:
```typescript
{
  items: { id: number; sortOrder: number }[];
}
```

---

### 블록 에디터

#### `cms.blocks.list` (GET)
**설명**: 페이지 블록 조회

**입력**:
```typescript
{ menuItemId?: number; menuSubItemId?: number }
```

---

#### `cms.blocks.create` (POST)
**설명**: 블록 생성

**입력**:
```typescript
{
  menuItemId?: number;
  menuSubItemId?: number;
  blockType: string;
  content: any; // JSON
  sortOrder?: number;
}
```

**응답**:
```typescript
{ insertId: number }
```

---

#### `cms.blocks.update` (POST)
**설명**: 블록 수정

**입력**:
```typescript
{
  id: number;
  blockType?: string;
  content?: any;
  sortOrder?: number;
  isVisible?: boolean;
}
```

---

#### `cms.blocks.delete` (POST)
**설명**: 블록 삭제

**입력**:
```typescript
{ id: number }
```

---

### 시설 관리

#### `cms.facilities.list` (GET)
**설명**: 모든 시설 조회

---

#### `cms.facilities.create` (POST)
**설명**: 시설 생성

**입력**:
```typescript
{
  name: string;
  description?: string;
  capacity: number;
  location?: string;
  sortOrder?: number;
}
```

---

#### `cms.facilities.update` (POST)
**설명**: 시설 수정

**입력**:
```typescript
{
  id: number;
  name?: string;
  description?: string;
  capacity?: number;
  location?: string;
  sortOrder?: number;
  isVisible?: boolean;
}
```

---

#### `cms.facilities.addBlockedDate` (POST)
**설명**: 예약 불가 날짜 추가

**입력**:
```typescript
{
  facilityId: number;
  blockedDate: Date;
  reason?: string;
}
```

---

### 예약 관리

#### `cms.reservations.list` (GET)
**설명**: 모든 예약 조회

**응답**:
```typescript
{
  id: number;
  facilityId: number;
  facilityName: string;
  userId: number;
  userName: string;
  reservationDate: Date;
  startTime: string;
  endTime: string;
  purpose: string;
  department: string;
  attendees: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  adminComment?: string;
  createdAt: Date;
}[]
```

---

#### `cms.reservations.approve` (POST)
**설명**: 예약 승인

**입력**:
```typescript
{
  id: number;
  adminComment?: string;
}
```

---

#### `cms.reservations.reject` (POST)
**설명**: 예약 거절

**입력**:
```typescript
{
  id: number;
  adminComment: string; // 거절 사유 필수
}
```

---

### 파일 업로드

#### `cms.upload.presignedUrl` (POST)
**설명**: S3 업로드용 presigned URL 발급

**입력**:
```typescript
{
  fileName: string;
  contentType: string; // "image/jpeg", "video/mp4" 등
}
```

**응답**:
```typescript
{
  uploadUrl: string; // PUT 요청 URL
  publicUrl: string; // 업로드 후 접근 URL
}
```

**사용 예**:
```typescript
// 1. presigned URL 발급
const { uploadUrl, publicUrl } = await trpc.cms.upload.presignedUrl.mutate({
  fileName: "photo.jpg",
  contentType: "image/jpeg"
});

// 2. 파일 업로드
await fetch(uploadUrl, {
  method: "PUT",
  headers: { "Content-Type": "image/jpeg" },
  body: fileBlob
});

// 3. publicUrl 사용
console.log(publicUrl); // 이미지 URL
```

---

### 유튜브 관리

#### `youtube.addVideo` (POST)
**설명**: 플레이리스트에 영상 추가

**입력**:
```typescript
{
  playlistId: number;
  videoId?: string; // 유튜브 ID
  videoUrl?: string; // 직접 URL
  title: string;
  description?: string;
}
```

---

#### `youtube.updateVideo` (POST)
**설명**: 영상 정보 수정

**입력**:
```typescript
{
  id: number;
  title?: string;
  description?: string;
  sortOrder?: number;
  isVisible?: boolean;
}
```

---

#### `youtube.deleteVideo` (POST)
**설명**: 영상 삭제

**입력**:
```typescript
{ id: number }
```

---

### 시스템

#### `system.notifyOwner` (POST)
**설명**: 소유자에게 알림 전송 (예: 새 예약 신청)

**입력**:
```typescript
{
  title: string;
  content: string;
}
```

**응답**:
```typescript
{ success: boolean }
```

---

## 에러 처리

### 에러 응답 형식
```typescript
{
  code: string; // "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "BAD_REQUEST", etc.
  message: string;
  data?: any;
}
```

### 주요 에러 코드

| 코드 | HTTP | 설명 |
|------|------|------|
| UNAUTHORIZED | 401 | 로그인 필요 |
| FORBIDDEN | 403 | 권한 없음 (admin 필요) |
| NOT_FOUND | 404 | 리소스 없음 |
| BAD_REQUEST | 400 | 입력값 오류 |
| CONFLICT | 409 | 중복 (예: 같은 시간 예약) |
| INTERNAL_SERVER_ERROR | 500 | 서버 에러 |

### 클라이언트에서 에러 처리
```typescript
const mutation = trpc.cms.menus.create.useMutation({
  onError: (error) => {
    if (error.data?.code === "UNAUTHORIZED") {
      // 로그인 페이지로 이동
      window.location.href = getLoginUrl();
    } else if (error.data?.code === "FORBIDDEN") {
      toast.error("관리자 권한이 필요합니다.");
    } else {
      toast.error(error.message);
    }
  }
});
```

---

## 배치 요청

tRPC는 여러 요청을 한 번에 처리하는 배칭을 지원합니다.

```typescript
// 여러 쿼리를 동시에 요청
const [menus, notices, facilities] = await Promise.all([
  trpc.home.menus.query(),
  trpc.home.notices.query(),
  trpc.home.facilities.query(),
]);
```

---

## 캐싱 전략

### React Query 캐싱
```typescript
// 기본 캐시 시간: 5분
const { data } = trpc.home.menus.useQuery();

// 캐시 무효화 (수동)
const utils = trpc.useUtils();
await utils.home.menus.invalidate();

// 캐시 무효화 (뮤테이션 후 자동)
const mutation = trpc.cms.menus.create.useMutation({
  onSuccess: () => {
    utils.home.menus.invalidate();
    utils.cms.menus.list.invalidate();
  }
});
```

---

## 참고 문서
- [시스템 아키텍처](./ARCHITECTURE.md)
- [데이터베이스 ERD](./DATABASE_ERD.md)
- [배포 가이드](./DEPLOYMENT.md)
