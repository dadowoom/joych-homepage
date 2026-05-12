# 운영 반영 후 검수 메모 (2026-05-12)

## 반영 상태

- PR #18 `메뉴 기준 데이터 정리` 병합 완료
- 운영 서버 배포 완료
  - 서버 소스: `/var/www/joych-homepage-src`
  - 런타임: `/var/www/joych-homepage`
  - PM2 앱: `joych-homepage`
  - 운영 반영 커밋: `33685f7`

## 버튼/링크 검수

브라우저 기준으로 실제 운영 사이트를 열어 확인했다.

- 공개 메뉴/CMS 동적 페이지: 21개 정상
- 소개/예배/교육 페이지: 31개 정상
- 사역/교회학교/선교보고 페이지: 14개 정상
- 커뮤니티/행정/시설/회원/관리자 주요 라우트: 25개 정상
- 홈 화면 노출 링크: 55개 추출 확인
- 홈 검색 버튼: 이름 입력 후 `/church-directory?name=...` 이동 정상
- 외부 링크:
  - YouTube: 200
  - Facebook: 302 후 공식 페이지 이동
  - Instagram: 200
  - 기부금 영수증: 200
  - 기쁨이 있는 곳: 200

`/admin`은 의도적으로 404 화면을 보여주는 보안용 숨김 경로다. 실제 관리자 경로는 `/admin_joych_2026`이다.

## 보안/운영 확인

- HTTPS 홈: 200
- HTTP 접속: HTTPS로 301 리다이렉트
- `/__manus__/`: 404
- 비로그인 `cms.notices.list`: 403 Forbidden
- 보안 헤더 적용 확인:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- PM2 재시작 후 앱 상태: online

## 이번 추가 수정

- `deploy.sh`에서 서버 비밀번호 하드코딩 제거
- `.env.production` 추적 파일 제거
- 문서에 남아 있던 실제 관리자 비밀번호 문자열 제거
- 홈 화면 문구 오탈자 수정: `나눥니다` → `나눕니다`

## 남은 보안 조치

이미 저장소 이력과 운영 환경에 노출된 것으로 봐야 하므로 납품 전 아래 값은 반드시 교체해야 한다.

- 서버 root 비밀번호
- DB 비밀번호
- `JWT_SECRET`
- 관리자 비밀번호

장기적으로는 root 비밀번호 SSH 대신 배포 전용 계정 + SSH 키 방식으로 바꾸는 것이 안전하다.
