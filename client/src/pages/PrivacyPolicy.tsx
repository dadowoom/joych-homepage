import SubPageLayout from "@/components/SubPageLayout";
import {
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  Cookie,
  Database,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";

const sectionLinks = [
  ["privacy-purpose", "1. 처리 목적"],
  ["privacy-items", "2. 수집 항목"],
  ["privacy-retention", "3. 보유 및 파기"],
  ["privacy-third-party", "4. 제공·위탁"],
  ["privacy-rights", "5. 이용자 권리"],
  ["privacy-automatic", "6. 쿠키·푸시"],
  ["privacy-security", "7. 안전성 조치"],
  ["privacy-contact", "8. 문의처"],
] as const;

const servicePurposes = [
  {
    title: "회원가입 및 본인 확인",
    description:
      "가입 신청자 식별, 중복가입 방지, 성도 회원 승인, 로그인 및 계정 복구를 위해 처리합니다.",
  },
  {
    title: "홈페이지 서비스 제공",
    description:
      "게시판, 강좌, 시설·차량 예약, 각종 신청과 접수 내역을 제공하고 처리 상태를 안내합니다.",
  },
  {
    title: "간편가입 연결",
    description:
      "카카오·구글 등 간편가입 제공자로부터 이용자가 동의한 정보를 받아 계정을 생성하고 연결합니다.",
  },
  {
    title: "알림 및 안전한 운영",
    description:
      "신청 결과와 필요한 공지를 전송하고, 부정 이용 방지·장애 대응·보안 유지를 위해 최소한의 기록을 처리합니다.",
  },
] as const;

function SectionTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#1B5E20] px-2 text-xs font-bold text-white">
          {number}
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PolicyCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-slate-900">{title}</h3>
        {badge && (
          <span className="rounded-full bg-[#E8F5E9] px-2.5 py-1 text-xs font-bold text-[#1B5E20]">
            {badge}
          </span>
        )}
      </div>
      <div className="text-sm leading-7 text-slate-600">{children}</div>
    </div>
  );
}

function BulletList({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2.5">{children}</ul>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle2 className="mt-1.5 h-3.5 w-3.5 shrink-0 text-[#2E7D32]" />
      <span>{children}</span>
    </li>
  );
}

export default function PrivacyPolicy() {
  return (
    <SubPageLayout pageTitle="개인정보처리방침">
      <article className="mx-auto max-w-5xl text-slate-700">
        <section className="relative overflow-hidden rounded-[28px] bg-[#123C20] px-6 py-8 text-white shadow-xl shadow-green-950/10 md:px-10 md:py-11">
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#4CAF50]/20 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-28 left-1/3 h-52 w-52 rounded-full bg-white/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-green-50">
              <ShieldCheck className="h-4 w-4" />
              기쁨의교회 개인정보 보호 안내
            </div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight md:text-4xl">
              소중한 개인정보를
              <br className="sm:hidden" /> 꼭 필요한 범위에서만 이용합니다.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-green-50/90 md:text-base">
              기쁨의교회는 개인정보 보호법 등 관계 법령을 준수하며, 홈페이지 이용자의
              개인정보를 안전하고 투명하게 관리합니다.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-green-50/80">
              <span>시행일 2026년 7월 24일</span>
              <span>버전 1.0</span>
              <span>공개 대상: 모든 홈페이지 이용자</span>
            </div>
          </div>
        </section>

        <section
          className="mt-6 grid gap-3 sm:grid-cols-3"
          aria-label="개인정보 처리 핵심 안내"
        >
          {[
            {
              icon: FileCheck2,
              title: "목적 내 최소 수집",
              body: "가입과 서비스 제공에 필요한 정보만 처리합니다.",
            },
            {
              icon: LockKeyhole,
              title: "안전한 보호",
              body: "접근권한 관리와 암호화 등 보호조치를 적용합니다.",
            },
            {
              icon: Trash2,
              title: "목적 달성 후 파기",
              body: "보유 이유가 끝난 정보는 지체 없이 파기합니다.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-[#DDEADF] bg-[#F7FBF7] p-5"
            >
              <Icon className="h-5 w-5 text-[#1B5E20]" />
              <h2 className="mt-3 text-sm font-bold text-slate-900">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
            </div>
          ))}
        </section>

        <nav
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 md:p-5"
          aria-label="개인정보처리방침 목차"
        >
          <p className="mb-3 text-sm font-bold text-slate-900">빠른 목차</p>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {sectionLinks.map(([href, label]) => (
              <a
                key={href}
                href={`#${href}`}
                className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-[#F1F8E9] hover:text-[#1B5E20]"
              >
                <span>{label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#1B5E20]" />
              </a>
            ))}
          </div>
        </nav>

        <div className="mt-12 space-y-14">
          <section id="privacy-purpose" className="scroll-mt-28">
            <SectionTitle
              number="1"
              title="개인정보의 처리 목적"
              description="수집한 개인정보는 아래 목적에 필요한 범위에서만 이용합니다."
            />
            <div className="grid gap-4 md:grid-cols-2">
              {servicePurposes.map((item) => (
                <PolicyCard key={item.title} title={item.title}>
                  {item.description}
                </PolicyCard>
              ))}
            </div>
          </section>

          <section id="privacy-items" className="scroll-mt-28">
            <SectionTitle
              number="2"
              title="처리하는 개인정보 항목과 수집 방법"
              description="화면에 별표(*)로 표시된 항목은 해당 서비스 이용에 필요한 필수 항목입니다."
            />
            <div className="space-y-4">
              <PolicyCard title="일반 회원가입" badge="직접 입력">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <p className="mb-2 font-bold text-slate-800">필수 항목</p>
                    <p>
                      이름, 이메일(로그인 ID), 비밀번호, 연락처, 생년월일, 성별,
                      직분
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 font-bold text-slate-800">
                      관리자 설정에 따른 추가 항목
                    </p>
                    <p>
                      주소, 비상연락처, 소속 부서, 구역·순, 믿음PLUS 사용자 ID,
                      가입 경로 등이며, 홈페이지 운영 설정에 따라 표시 여부와 필수
                      여부가 달라질 수 있습니다.
                    </p>
                  </div>
                </div>
                <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                  비밀번호는 원문을 보관하지 않고 복구할 수 없는 단방향 암호화 값으로
                  저장합니다.
                </p>
              </PolicyCard>

              <PolicyCard title="카카오 간편가입" badge="카카오 동의 후 수집">
                <BulletList>
                  <Bullet>
                    카카오계정 이름, 카카오계정 이메일, 카카오 회원번호(서비스 연결용
                    provider ID)
                  </Bullet>
                  <Bullet>
                    카카오에서 제공하지 않는 필수 정보(연락처, 생년월일, 성별, 직분
                    등)는 가입 화면에서 이용자가 직접 입력합니다.
                  </Bullet>
                  <Bullet>
                    실제 제공 항목은 카카오 동의 화면에서 이용자가 동의한 범위에
                    한하며, 프로필 정보는 사용하도록 설정된 경우에만 수집합니다.
                  </Bullet>
                </BulletList>
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                  카카오계정 이름은 가입 신청자의 실명 항목을 자동 입력하고 성도 확인
                  및 중복가입 방지에 이용합니다. 카카오 회원번호는 비밀번호 대신
                  동일한 간편가입 계정을 안전하게 식별하는 용도로만 사용합니다.
                </div>
              </PolicyCard>

              <PolicyCard title="Google 간편가입" badge="Google 동의 후 수집">
                <BulletList>
                  <Bullet>
                    Google 계정 이름, 이메일, 프로필 이미지, Google 회원번호(서비스
                    연결용 provider ID)
                  </Bullet>
                  <Bullet>
                    Google에서 제공하지 않는 필수 정보(연락처, 생년월일, 성별, 직분
                    등)는 가입 화면에서 이용자가 직접 입력합니다.
                  </Bullet>
                  <Bullet>
                    실제 제공 항목은 Google 동의 화면에서 이용자가 동의한 범위에
                    한하며, 간편가입 연결과 회원 식별 목적으로만 이용합니다.
                  </Bullet>
                </BulletList>
              </PolicyCard>

              <PolicyCard title="서비스 이용 중 생성·수집되는 정보">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <p className="mb-2 font-bold text-slate-800">신청·예약 정보</p>
                    <p>
                      시설·차량 예약 내용, 강좌 신청 내용, 탐방·주보광고·자막 등 각종
                      신청 내용, 처리 상태 및 작성 일시
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 font-bold text-slate-800">자동 생성 정보</p>
                    <p>
                      접속 일시, IP 주소, 브라우저·기기 정보, 쿠키, 오류 및 보안 기록,
                      웹 푸시 구독 식별정보
                    </p>
                  </div>
                </div>
              </PolicyCard>
            </div>
          </section>

          <section id="privacy-retention" className="scroll-mt-28">
            <SectionTitle
              number="3"
              title="보유기간과 개인정보의 파기"
              description="보유 목적이 달성되면 복구할 수 없는 방법으로 지체 없이 파기합니다."
            />
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {[
                {
                  label: "회원 계정 및 기본정보",
                  value:
                    "회원 탈퇴 또는 가입 철회 시까지. 탈퇴 시 계정 식별정보는 삭제하거나 익명화합니다.",
                },
                {
                  label: "가입 승인 대기 정보",
                  value:
                    "가입 신청을 철회하거나 관리자가 계정을 삭제하거나 이용자가 삭제를 요청할 때까지 보관합니다.",
                },
                {
                  label: "예약·강좌·각종 신청 정보",
                  value:
                    "해당 신청의 처리와 사후 확인이 끝날 때까지 보관하며, 이용자 요청 또는 보유 목적 달성 후 삭제·익명화합니다.",
                },
                {
                  label: "웹 푸시 구독정보",
                  value: "알림 수신 해제 또는 구독 만료 시까지",
                },
                {
                  label: "접속·보안 기록",
                  value:
                    "보안 및 장애 대응에 필요한 최소 기간 동안 보관한 뒤 파기합니다. 관계 법령이 별도 기간을 정한 경우에는 해당 기간을 따릅니다.",
                },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className={`grid gap-1 px-5 py-4 md:grid-cols-[210px_1fr] md:gap-6 ${
                    index > 0 ? "border-t border-slate-100" : ""
                  }`}
                >
                  <strong className="text-sm text-slate-900">{item.label}</strong>
                  <p className="text-sm leading-6 text-slate-600">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-100 px-5 py-4 text-sm leading-6 text-slate-600">
              <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
              <p>
                전자적 파일은 복구·재생할 수 없는 방법으로 삭제하고, 출력물은
                분쇄하거나 소각합니다. 다른 법령에 따라 일정 기간 보존해야 하는
                경우에는 해당 정보만 분리하여 안전하게 보관하고 목적 외로 이용하지
                않습니다.
              </p>
            </div>
          </section>

          <section id="privacy-third-party" className="scroll-mt-28">
            <SectionTitle
              number="4"
              title="개인정보의 제3자 제공 및 처리 위탁"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <PolicyCard title="제3자 제공">
                기쁨의교회는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
                다만 이용자가 사전에 동의한 경우, 법령에 특별한 규정이 있거나 생명·신체
                보호를 위해 긴급히 필요한 경우에는 관계 법령이 허용하는 범위에서 제공할
                수 있습니다.
              </PolicyCard>
              <PolicyCard title="간편가입 정보 수집">
                카카오·구글 간편가입 시 해당 제공자의 동의 화면을 통해 이용자가 허용한
                정보를 전달받습니다. 간편가입 제공자는 각 회사의 개인정보처리방침에 따라
                계정 정보를 관리하며, 기쁨의교회는 전달받은 정보를 본 방침에 따라
                처리합니다.
              </PolicyCard>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#1B5E20]" />
                <h3 className="font-bold text-slate-900">처리 위탁 안내</h3>
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[minmax(120px,0.8fr)_minmax(180px,1.5fr)] bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700">
                  <span>수탁자</span>
                  <span>위탁 업무</span>
                </div>
                <div className="grid grid-cols-[minmax(120px,0.8fr)_minmax(180px,1.5fr)] gap-3 border-t border-slate-200 px-4 py-3 text-sm leading-6 text-slate-600">
                  <strong className="text-slate-900">(주)스마일서브(iwinv)</strong>
                  <span>서버·데이터베이스·네트워크 등 홈페이지 운영 인프라 제공</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-500">
                위탁계약 종료 또는 위탁 목적 달성 시 관련 정보를 파기합니다. 수탁자나
                위탁 업무가 변경되면 본 페이지를 통해 지체 없이 공개합니다.
              </p>
            </div>
          </section>

          <section id="privacy-rights" className="scroll-mt-28">
            <SectionTitle
              number="5"
              title="이용자의 권리와 행사 방법"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <PolicyCard title="이용자가 행사할 수 있는 권리">
                <BulletList>
                  <Bullet>본인의 개인정보 열람 요구</Bullet>
                  <Bullet>잘못된 정보의 정정 또는 삭제 요구</Bullet>
                  <Bullet>개인정보 처리 정지 및 동의 철회 요구</Bullet>
                  <Bullet>회원 탈퇴 및 간편가입 연결 해제</Bullet>
                </BulletList>
              </PolicyCard>
              <PolicyCard title="요청 방법">
                홈페이지 내정보 화면 또는 아래 개인정보 보호 문의처로 요청할 수
                있습니다. 기쁨의교회는 요청자의 본인 여부를 확인한 후 관계 법령이 정한
                기간 안에 조치하고 결과를 안내합니다. 법정대리인은 만 14세 미만 아동을
                대신해 권리를 행사할 수 있습니다.
              </PolicyCard>
            </div>
            <p className="mt-4 rounded-2xl border border-green-100 bg-[#F7FBF7] px-5 py-4 text-sm leading-6 text-slate-600">
              필수 개인정보 수집에 동의하지 않을 권리가 있습니다. 다만 회원 식별과
              서비스 제공에 꼭 필요한 필수 항목에 동의하지 않으면 회원가입 또는 해당
              서비스 이용이 제한될 수 있습니다. 추가 항목 중 선택 항목으로 표시된
              정보는 입력하지 않아도 기본 회원가입에는 불이익이 없습니다.
            </p>
          </section>

          <section id="privacy-automatic" className="scroll-mt-28">
            <SectionTitle
              number="6"
              title="쿠키, 접속기록 및 웹 푸시 알림"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <PolicyCard title="쿠키와 세션">
                <div className="mb-3 flex items-center gap-2 text-[#1B5E20]">
                  <Cookie className="h-5 w-5" />
                  <strong>로그인 상태와 서비스 이용 유지</strong>
                </div>
                홈페이지는 로그인 상태 유지, 보안 및 기본 기능 제공을 위해 쿠키 또는
                유사한 저장기술을 사용할 수 있습니다. 브라우저 설정에서 쿠키를
                차단하거나 삭제할 수 있으나, 로그인 등 일부 기능이 정상 동작하지 않을 수
                있습니다.
              </PolicyCard>
              <PolicyCard title="웹 푸시 알림">
                <div className="mb-3 flex items-center gap-2 text-[#1B5E20]">
                  <Bell className="h-5 w-5" />
                  <strong>기기에서 명시적으로 허용한 경우만 발송</strong>
                </div>
                예약·신청 처리 결과와 필요한 공지를 전달하기 위해 기기별 푸시 구독정보를
                처리할 수 있습니다. 브라우저 또는 기기 알림 설정에서 언제든 수신을
                거부할 수 있습니다.
              </PolicyCard>
            </div>
          </section>

          <section id="privacy-security" className="scroll-mt-28">
            <SectionTitle
              number="7"
              title="개인정보의 안전성 확보 조치"
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: KeyRound,
                  title: "비밀번호 보호",
                  body: "비밀번호 단방향 암호화 및 안전한 로그인 세션 관리",
                },
                {
                  icon: UserCheck,
                  title: "접근권한 최소화",
                  body: "업무에 필요한 관리자에게만 권한을 부여하고 권한을 구분",
                },
                {
                  icon: Database,
                  title: "시스템 보호",
                  body: "전송구간 암호화, 보안 업데이트, 장애·접속기록 점검",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <Icon className="h-5 w-5 text-[#1B5E20]" />
                  <h3 className="mt-3 text-sm font-bold text-slate-900">{title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="privacy-contact" className="scroll-mt-28">
            <SectionTitle
              number="8"
              title="개인정보 보호 문의처"
              description="개인정보 관련 문의, 열람·정정·삭제 및 처리정지 요청을 접수합니다."
            />
            <div className="overflow-hidden rounded-[24px] border border-[#CFE3D2] bg-[#F7FBF7]">
              <div className="border-b border-[#DDEADF] px-6 py-5 md:px-8">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#43824B]">
                  Privacy Contact
                </p>
                <h3 className="mt-1 text-xl font-extrabold text-slate-900">
                  기쁨의교회 행정실
                </h3>
              </div>
              <div className="grid gap-4 px-6 py-6 text-sm md:grid-cols-2 md:px-8">
                <a
                  href="tel:0542701000"
                  className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-slate-700 shadow-sm transition-colors hover:text-[#1B5E20]"
                >
                  <Phone className="h-5 w-5 text-[#1B5E20]" />
                  <span>
                    <span className="block text-xs text-slate-400">전화</span>
                    <strong>054-270-1000</strong>
                  </span>
                </a>
                <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-slate-700 shadow-sm">
                  <MapPin className="h-5 w-5 shrink-0 text-[#1B5E20]" />
                  <span>
                    <span className="block text-xs text-slate-400">주소</span>
                    <strong>경북 포항시 북구 삼호로 411</strong>
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-3 text-xs leading-5 text-slate-500">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                개인정보 침해에 대한 신고나 상담이 필요한 경우 개인정보침해
                신고센터(국번 없이 118), 개인정보분쟁조정위원회, 경찰청 또는
                대검찰청의 개인정보 관련 신고기관에 문의할 수 있습니다.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-sm leading-6 text-slate-600 md:px-6">
            <h2 className="font-bold text-slate-900">처리방침 변경 안내</h2>
            <p className="mt-2">
              법령, 서비스 또는 개인정보 처리 내용이 변경되면 변경사항과 시행일을 본
              페이지에 공개합니다. 이용자의 권리에 중대한 영향을 주는 변경은 홈페이지
              공지 등 알기 쉬운 방법으로 별도 안내합니다.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <span>공고일: 2026년 7월 24일</span>
              <span>시행일: 2026년 7월 24일</span>
              <span>버전: 1.0</span>
            </div>
          </section>
        </div>
      </article>
    </SubPageLayout>
  );
}
