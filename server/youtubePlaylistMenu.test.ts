import { describe, expect, it } from "vitest";
import {
  getCanonicalJoyfulTvPlaylistTitle,
  matchesJoyfulTvPlaylistMenuLabel,
} from "./_core/youtubePlaylistMenu";

describe("조이풀TV 3단 메뉴 플레이리스트 연결", () => {
  it.each([
    [90007, "샬롬 성가대", "[주일 1부]샬롬 찬양대"],
    [90008, "호산나 찬양대", "[주일 2부]호산나 찬양대"],
    [90009, "시온 찬양대", "[주일 3부]시온 찬양대"],
    [90010, "[주일 찬양팀]조이언스", "[주일 찬양팀]조이언스"],
    [90011, "디사이플스", "[수요 찬양팀]디사이플스"],
    [90015, "[금요 찬양팀]카리스", "[금요 찬양팀]카리스"],
    [90016, "[청년부 찬양팀]리빌드", "[청년부 찬양팀]리빌드"],
    [90017, "특송", "예배특송"],
  ])("플레이리스트 %s를 정해진 3단 메뉴에 연결한다", (id, playlistTitle, menuTitle) => {
    expect(matchesJoyfulTvPlaylistMenuLabel(menuTitle, id, playlistTitle)).toBe(true);
    expect(getCanonicalJoyfulTvPlaylistTitle(id, playlistTitle)).toBe(menuTitle);
  });

  it("일반 플레이리스트는 이름이 같은 메뉴에만 연결한다", () => {
    expect(matchesJoyfulTvPlaylistMenuLabel("주일예배", 60004, "주일예배")).toBe(true);
    expect(matchesJoyfulTvPlaylistMenuLabel("헤브론 수요예배", 60004, "주일예배")).toBe(false);
  });
});
