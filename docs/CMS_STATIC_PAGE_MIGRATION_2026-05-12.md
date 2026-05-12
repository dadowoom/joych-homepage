# CMS 정적 페이지 전환 계획

## 원칙

- 공개 화면의 기존 레이아웃, 색상, 글자 크기, 배치, 카드 구조는 변경하지 않는다.
- 기존 React 페이지 템플릿은 그대로 사용하고, 화면에 들어가는 본문 데이터만 CMS 저장값으로 분리한다.
- 기능 페이지(로그인, 회원가입, 시설 예약, 선교보고 작성/상세, 관리자)는 CMS 일반 페이지로 바꾸지 않는다. 기능 로직이 있는 화면은 기능 모듈로 유지한다.
- DB 저장값이 없거나 깨졌을 때는 코드 기본값으로 자동 fallback 하여 공개 화면이 비지 않게 한다.

## 1차 전환 완료 범위

`MinistryPage` 템플릿을 쓰는 사역/양육 소개 페이지를 CMS 콘텐츠 관리 대상으로 분리했다.

- `/education/hesed` 헤세드아시아포재팬
- `/education/disciple2` 제자훈련
- `/education/elder` 순장 훈련
- `/education/one-on-one` 일대일 양육
- `/education/sunseumschool` 순세움학교
- `/education/saengseon` 생선 컨퍼런스
- `/ministry/world-mission` 세계선교부
- `/ministry/evangelism` 기쁨의 전도부
- `/ministry/prayer` 기도사역부
- `/ministry/welfare` 기쁨의 복지재단
- `/ministry/vision-univ` 비전대학
- `/ministry/joylab` 조이랩

## 구현 방식

- 기본 콘텐츠는 `shared/staticPageContent.ts`에 seed 형태로 보관한다.
- 실제 CMS 저장값은 `site_settings` 테이블의 `static_page:{href}` 키에 JSON으로 저장한다.
- 공개 화면은 `home.staticPageContent`를 통해 CMS 저장값을 조회하고, 없으면 seed 기본값을 사용한다.
- 관리자 화면에는 `페이지 콘텐츠` 탭을 추가하여 JSON 콘텐츠를 수정/저장/복원할 수 있게 했다.
- 초기 복사는 `pnpm cms:seed-static-pages`로 실행한다.

## 다음 전환 후보

- 교회학교 부서 소개 페이지: `DepartmentPage` 템플릿 기반이라 같은 방식으로 전환 가능.
- 예배/커뮤니티/행정 안내 페이지: 화면 구조가 제각각이라 페이지별 전용 데이터 스키마를 잡아야 디자인을 유지할 수 있다.
- 일반 블록 에디터 페이지: 새로 만든 메뉴/페이지에는 계속 사용 가능하지만, 기존 고정 디자인 페이지를 그대로 복제하는 용도로는 적합하지 않다.
