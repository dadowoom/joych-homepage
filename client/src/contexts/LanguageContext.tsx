import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type SiteLanguage = "ko" | "ja";

const STORAGE_KEY = "joych_site_language";

const jaDictionary: Record<string, string> = {
  "깊이있는 성장, 위대한 교회": "深みのある成長、偉大な教会",
  "내 정보": "マイページ",
  "로그아웃": "ログアウト",
  "로그인": "ログイン",
  "회원가입": "会員登録",
  "유튜브": "YouTube",
  "페이스북": "Facebook",
  "인스타그램": "Instagram",
  "이름으로 신앙 데이터 검색": "名前で信仰データを検索",
  "검색": "検索",
  "성도 이름을 입력하면 신앙 데이터 페이지로 이동합니다.": "信徒名を入力すると信仰データページへ移動します。",
  "홈": "ホーム",
  "교회소개": "教会紹介",
  "조이풀TV": "ジョイフルTV",
  "커뮤니티": "コミュニティ",
  "행정지원": "事務サポート",
  "양육/훈련": "養育・訓練",
  "사역/선교": "奉仕・宣教",
  "담임목사 인사말": "主任牧師あいさつ",
  "섬기는 분": "奉仕者紹介",
  "부교역자": "副教役者",
  "교회 비전": "教会ビジョン",
  "오시는 길": "アクセス",
  "새가족 안내": "新来者案内",
  "페이지 불러오는 중...": "ページを読み込んでいます...",
  "불러오는 중...": "読み込み中...",
  "페이지를 찾을 수 없습니다": "ページが見つかりません",
  "요청하신 페이지가 존재하지 않습니다.": "お探しのページは存在しません。",
  "주요 활동": "主な活動",
  "문의 및 연락처": "お問い合わせ",
};

type LanguageContextValue = {
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
  toggleLanguage: () => void;
  t: (text: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): SiteLanguage {
  if (typeof window === "undefined") return "ko";
  return window.localStorage.getItem(STORAGE_KEY) === "ja" ? "ja" : "ko";
}

export function translateSiteText(text: string, language: SiteLanguage) {
  if (language !== "ja") return text;
  return jaDictionary[text] ?? text;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SiteLanguage>(getInitialLanguage);

  const setLanguage = (nextLanguage: SiteLanguage) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  };

  useEffect(() => {
    document.documentElement.lang = language === "ja" ? "ja" : "ko";
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    toggleLanguage: () => setLanguage(language === "ja" ? "ko" : "ja"),
    t: (text: string) => translateSiteText(text, language),
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return value;
}
