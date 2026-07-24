export const WORSHIP_SCHEDULE_DRAFT_HREF = "/worship/schedule";
export const WORSHIP_SCHEDULE_BETA_HREF = "/worship/schedule-beta";
export const WORSHIP_SCHEDULE_SETTING_PREFIX = "worship_schedule:";
export const WORSHIP_SCHEDULE_DRAFT_SETTING_KEY =
  `${WORSHIP_SCHEDULE_SETTING_PREFIX}draft`;

export const WORSHIP_SCHEDULE_LIMITS = {
  sections: 12,
  entriesPerSection: 30,
  title: 80,
  label: 100,
  time: 80,
  note: 180,
  notice: 500,
} as const;

export const WORSHIP_SCHEDULE_THEMES = [
  "green",
  "blue",
  "amber",
  "rose",
  "purple",
  "slate",
] as const;

export const WORSHIP_SCHEDULE_ICONS = [
  "sun",
  "church",
  "moon",
  "fire",
  "cross",
  "heart",
  "users",
  "bell",
] as const;

export type WorshipScheduleTheme = (typeof WORSHIP_SCHEDULE_THEMES)[number];
export type WorshipScheduleIcon = (typeof WORSHIP_SCHEDULE_ICONS)[number];

export type WorshipScheduleEntry = {
  id: string;
  label: string;
  time: string;
  note: string;
};

export type WorshipScheduleSection = {
  id: string;
  title: string;
  theme: WorshipScheduleTheme;
  icon: WorshipScheduleIcon;
  entries: WorshipScheduleEntry[];
};

export type WorshipScheduleContent = {
  sections: WorshipScheduleSection[];
  notice: string;
};

/**
 * 관리자 체험판의 초기 예시입니다.
 * 공개 `/worship/schedule` 화면은 공식 전환 전까지 이 값을 사용하지 않습니다.
 */
export const DEFAULT_WORSHIP_SCHEDULE_DRAFT: WorshipScheduleContent = {
  sections: [
    {
      id: "sunday",
      title: "주일예배",
      theme: "green",
      icon: "sun",
      entries: [
        { id: "sunday-1", label: "1부 예배", time: "오전 7:30", note: "본당" },
        { id: "sunday-2", label: "2부 예배", time: "오전 9:00", note: "본당" },
        { id: "sunday-3", label: "3부 예배", time: "오전 11:00", note: "본당 (주요 예배)" },
        { id: "sunday-4", label: "4부 예배", time: "오후 1:30", note: "본당" },
        { id: "sunday-online", label: "온라인 예배", time: "오전 11:00", note: "유튜브 실시간 방송" },
      ],
    },
    {
      id: "wednesday",
      title: "수요예배",
      theme: "blue",
      icon: "church",
      entries: [
        { id: "wednesday-1", label: "수요예배", time: "오전 11:00", note: "본당" },
        { id: "wednesday-2", label: "수요예배", time: "오후 7:30", note: "본당" },
      ],
    },
    {
      id: "dawn",
      title: "새벽기도회",
      theme: "amber",
      icon: "moon",
      entries: [
        { id: "dawn-1", label: "새벽기도", time: "오전 5:30", note: "월~토 / 본당" },
      ],
    },
    {
      id: "friday",
      title: "금요기도회",
      theme: "rose",
      icon: "fire",
      entries: [
        { id: "friday-1", label: "금요기도회", time: "오후 8:00", note: "본당" },
      ],
    },
  ],
  notice:
    "예배 시간은 교회 사정에 따라 변경될 수 있습니다. 변경 사항은 주보 및 교회 공지를 통해 안내드립니다.",
};

export function cloneWorshipScheduleContent(
  content: WorshipScheduleContent,
): WorshipScheduleContent {
  return {
    notice: content.notice,
    sections: content.sections.map(section => ({
      ...section,
      entries: section.entries.map(entry => ({ ...entry })),
    })),
  };
}
