/**
 * 기쁨의교회 — 양육/훈련/교회학교 그룹 페이지
 * 디자인: Warm Modern Sacred — 녹색 포인트, Noto Serif KR
 * 포함: NewMember / DiscipleTraining / BibleStudy / SundaySchool (유아~중고등부 통합)
 */

import { useState } from "react";
import { Link } from "wouter";

function PageHeader({ title, subtitle, breadcrumb }: { title: string; subtitle?: string; breadcrumb: string[] }) {
  return (
    <div className="bg-[#1B5E20] text-white py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <nav className="text-sm text-green-200 mb-4 flex items-center gap-2">
          <Link href="/" className="hover:text-white transition-colors">홈</Link>
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-2">
              <i className="fas fa-chevron-right text-xs text-green-400"></i>
              <span className={i === breadcrumb.length - 1 ? "text-white font-medium" : ""}>{b}</span>
            </span>
          ))}
        </nav>
        <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>{title}</h1>
        {subtitle && <p className="mt-3 text-green-100 text-base">{subtitle}</p>}
      </div>
    </div>
  );
}

function SubNav({ items }: { items: { label: string; href: string }[] }) {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 flex overflow-x-auto">
        {items.map((item, i) => (
          <Link key={i} href={item.href}
            className="flex-shrink-0 px-5 py-4 text-sm font-medium text-gray-600 hover:text-[#1B5E20] border-b-2 border-transparent hover:border-[#1B5E20] transition-all whitespace-nowrap">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

const TRAINING_NAV = [
  { label: "새가족 교육", href: "/training/new-member" },
  { label: "제자훈련", href: "/training/disciple" },
  { label: "성경공부", href: "/training/bible" },
];

const SCHOOL_NAV = [
  { label: "유아부", href: "/school/infant" },
  { label: "유치부", href: "/school/kindergarten" },
  { label: "초등부", href: "/school/elementary" },
  { label: "중고등부", href: "/school/youth" },
];

// ── 새가족 교육 ──────────────────────────────────────────────────
const NEW_MEMBER_STEPS = [
  { step: "01", title: "새가족 등록", desc: "홈페이지 또는 안내 데스크에서 새가족 등록을 합니다.", icon: "fa-user-plus" },
  { step: "02", title: "새가족 환영 예배", desc: "매월 첫째 주일 오후 2시, 새가족 환영 예배에 참석합니다.", icon: "fa-church" },
  { step: "03", title: "새가족 교육 (4주)", desc: "교회 소개, 신앙 기초, 소그룹 생활 등 4주 과정을 이수합니다.", icon: "fa-book-open" },
  { step: "04", title: "목장 배정", desc: "교육 이수 후 가까운 지역 목장에 배정되어 공동체 생활을 시작합니다.", icon: "fa-users" },
];

export function NewMember() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="새가족 교육" subtitle="기쁨의교회에 오신 것을 환영합니다" breadcrumb={["양육/훈련", "새가족 교육"]} />
      <SubNav items={TRAINING_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        {/* 환영 메시지 */}
        <div className="bg-white rounded-2xl p-8 shadow-sm mb-10 text-center">
          <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto mb-5">
            <i className="fas fa-heart text-[#1B5E20] text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>기쁨의교회에 오신 것을 환영합니다</h2>
          <p className="text-gray-600 leading-relaxed max-w-xl mx-auto text-sm">
            처음 오신 분들이 교회 공동체에 자연스럽게 정착할 수 있도록 새가족 교육 과정을 운영하고 있습니다.
            아래 4단계 과정을 통해 기쁨의교회 가족이 되어 주세요.
          </p>
        </div>

        {/* 4단계 과정 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {NEW_MEMBER_STEPS.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm text-center relative">
              {i < NEW_MEMBER_STEPS.length - 1 && (
                <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                  <i className="fas fa-chevron-right text-[#1B5E20] text-sm"></i>
                </div>
              )}
              <div className="text-xs font-bold text-[#1B5E20] tracking-widest mb-3">STEP {s.step}</div>
              <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto mb-4">
                <i className={`fas ${s.icon} text-[#1B5E20]`}></i>
              </div>
              <h3 className="font-bold text-gray-800 text-sm mb-2">{s.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* 등록 CTA */}
        <div className="bg-[#1B5E20] rounded-2xl p-8 text-center text-white">
          <h3 className="text-xl font-bold mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>새가족 등록 신청</h3>
          <p className="text-green-100 text-sm mb-6">온라인으로 간편하게 새가족 등록을 하실 수 있습니다.</p>
          <Link href="/community/new-member" className="inline-block bg-white text-[#1B5E20] font-bold px-8 py-3 rounded-full hover:bg-green-50 transition-colors">
            새가족 등록하기
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── 제자훈련 ─────────────────────────────────────────────────────
const DISCIPLE_COURSES = [
  { level: "기초", title: "새가족 양육 과정", duration: "4주", target: "새가족", desc: "신앙의 기초를 다지는 입문 과정입니다.", color: "bg-green-50" },
  { level: "1단계", title: "제자훈련 1단계", duration: "1년", target: "세례 교인", desc: "성경의 핵심 진리와 그리스도인의 삶을 배웁니다.", color: "bg-blue-50" },
  { level: "2단계", title: "사역훈련", duration: "1년", target: "제자훈련 이수자", desc: "교회 사역자로 세워지는 심화 훈련 과정입니다.", color: "bg-purple-50" },
  { level: "심화", title: "리더십 과정", duration: "6개월", target: "사역훈련 이수자", desc: "목장 리더 및 각 부서 리더를 위한 훈련 과정입니다.", color: "bg-amber-50" },
];

export function DiscipleTraining() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="제자훈련" subtitle="그리스도의 제자로 세워지는 훈련 과정" breadcrumb={["양육/훈련", "제자훈련"]} />
      <SubNav items={TRAINING_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DISCIPLE_COURSES.map((c, i) => (
            <div key={i} className={`rounded-2xl p-7 shadow-sm ${c.color}`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-[#1B5E20] bg-[#E8F5E9] px-3 py-1 rounded-full">{c.level}</span>
                <span className="text-xs text-gray-400">{c.duration}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>{c.title}</h3>
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">{c.desc}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <i className="fas fa-user text-[#1B5E20]"></i>
                <span>대상: {c.target}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm text-center">
          <p className="text-gray-600 text-sm mb-4">훈련 등록 및 문의는 교육부 담당자에게 연락해 주세요.</p>
          <p className="font-medium text-[#1B5E20]"><i className="fas fa-phone mr-2"></i>054-270-1000</p>
        </div>
      </div>
    </div>
  );
}

// ── 성경공부 ─────────────────────────────────────────────────────
const BIBLE_CLASSES = [
  { title: "히브리서 강해", teacher: "담당 목회자", schedule: "매주 화요일 오전 10:00", location: "본당 소예배실", participants: 45 },
  { title: "로마서 심층 연구", teacher: "담당 목회자", schedule: "매주 목요일 오후 7:30", location: "교육관 301호", participants: 28 },
  { title: "구약 개론", teacher: "담당 목회자", schedule: "매주 수요일 오전 10:00", location: "교육관 201호", participants: 32 },
  { title: "신약 인물 연구", teacher: "담당 목회자", schedule: "매주 금요일 오후 2:00", location: "교육관 202호", participants: 20 },
];

export function BibleStudy() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="성경공부" subtitle="하나님의 말씀을 함께 깊이 연구합니다" breadcrumb={["양육/훈련", "성경공부"]} />
      <SubNav items={TRAINING_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="space-y-4">
          {BIBLE_CLASSES.map((c, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center gap-5">
              <div className="w-12 h-12 rounded-xl bg-[#E8F5E9] flex items-center justify-center flex-shrink-0">
                <i className="fas fa-bible text-[#1B5E20] text-lg"></i>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 text-base mb-1" style={{ fontFamily: "'Noto Serif KR', serif" }}>{c.title}</h3>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
                  <span><i className="fas fa-user text-[#1B5E20] mr-1.5"></i>{c.teacher}</span>
                  <span><i className="fas fa-clock text-[#1B5E20] mr-1.5"></i>{c.schedule}</span>
                  <span><i className="fas fa-map-marker-alt text-[#1B5E20] mr-1.5"></i>{c.location}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{c.participants}명 참여 중</span>
                <button className="bg-[#1B5E20] text-white text-sm px-5 py-2 rounded-full hover:bg-[#2E7D32] transition-colors">
                  신청하기
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 교회학교 (유아~중고등부 통합) ─────────────────────────────────
const SCHOOL_DEPTS = [
  { id: "infant", name: "유아부", age: "0~3세", icon: "fa-baby", color: "bg-pink-50 border-pink-200", iconBg: "bg-pink-100", iconColor: "text-pink-600", teacher: "부서 담당자", time: "주일 오전 11:00", room: "교육관 101호", desc: "하나님의 사랑 안에서 건강하게 자라나는 우리 아이들을 위한 예배입니다." },
  { id: "kindergarten", name: "유치부", age: "4~7세", icon: "fa-child", color: "bg-yellow-50 border-yellow-200", iconBg: "bg-yellow-100", iconColor: "text-yellow-600", teacher: "부서 담당자", time: "주일 오전 11:00", room: "교육관 102호", desc: "찬양과 말씀으로 하나님을 알아가는 유치부 예배입니다." },
  { id: "elementary", name: "초등부", age: "초등학교 1~6학년", icon: "fa-pencil-alt", color: "bg-blue-50 border-blue-200", iconBg: "bg-blue-100", iconColor: "text-blue-600", teacher: "부서 담당자", time: "주일 오전 11:00", room: "교육관 201~203호", desc: "말씀과 친구들과 함께 믿음이 자라는 초등부 예배입니다." },
  { id: "youth", name: "중고등부", age: "중학교 1학년 ~ 고등학교 3학년", icon: "fa-graduation-cap", color: "bg-purple-50 border-purple-200", iconBg: "bg-purple-100", iconColor: "text-purple-600", teacher: "부서 담당자", time: "주일 오전 11:00", room: "교육관 301~303호", desc: "다음 세대 리더를 세우는 중고등부 예배입니다." },
];

export function SundaySchool({ dept }: { dept: string }) {
  const info = SCHOOL_DEPTS.find(d => d.id === dept) || SCHOOL_DEPTS[0];
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title={info.name} subtitle={`${info.age} 대상 교회학교`} breadcrumb={["교회학교", info.name]} />
      <SubNav items={SCHOOL_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 부서 정보 */}
          <div className="lg:col-span-1">
            <div className={`rounded-2xl border p-7 shadow-sm ${info.color}`}>
              <div className={`w-16 h-16 rounded-full ${info.iconBg} flex items-center justify-center mb-5`}>
                <i className={`fas ${info.icon} ${info.iconColor} text-2xl`}></i>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>{info.name}</h2>
              <p className="text-gray-600 text-sm leading-relaxed mb-5">{info.desc}</p>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-3"><i className="fas fa-user text-[#1B5E20] w-4 mt-0.5"></i><span>담당: {info.teacher}</span></div>
                <div className="flex items-start gap-3"><i className="fas fa-clock text-[#1B5E20] w-4 mt-0.5"></i><span>{info.time}</span></div>
                <div className="flex items-start gap-3"><i className="fas fa-map-marker-alt text-[#1B5E20] w-4 mt-0.5"></i><span>{info.room}</span></div>
                <div className="flex items-start gap-3"><i className="fas fa-users text-[#1B5E20] w-4 mt-0.5"></i><span>대상: {info.age}</span></div>
              </div>
            </div>
          </div>
          {/* 주요 활동 */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl p-7 shadow-sm">
              <h3 className="font-bold text-gray-800 text-lg mb-5" style={{ fontFamily: "'Noto Serif KR', serif" }}>주요 활동</h3>
              <div className="grid grid-cols-2 gap-4">
                {["주일 예배", "소그룹 모임", "여름 성경학교", "수련회", "찬양 예배", "봉사 활동"].map((act, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <i className="fas fa-check-circle text-[#1B5E20]"></i> {act}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-7 shadow-sm">
              <h3 className="font-bold text-gray-800 text-lg mb-5" style={{ fontFamily: "'Noto Serif KR', serif" }}>최근 소식</h3>
              <div className="space-y-4">
                {[
                  { title: `${info.name} 공지사항은 준비 중입니다`, date: "공지 예정" },
                  { title: `${info.name} 행사 일정은 확정 후 안내됩니다`, date: "공지 예정" },
                  { title: `${info.name} 문의는 교회 사무실로 연락해 주세요`, date: "054-270-1000" },
                ].map((n, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{n.title}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-4">{n.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
