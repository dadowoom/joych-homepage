export type JoyfulTvPlaylistDefinition = {
  id: number;
  title: string;
  aliases: readonly string[];
};

export const JOYFUL_TV_THIRD_LEVEL_PLAYLISTS: readonly JoyfulTvPlaylistDefinition[] = [
  { id: 90007, title: "[주일 1부]샬롬 찬양대", aliases: ["샬롬 성가대", "샬롬 찬양대"] },
  { id: 90008, title: "[주일 2부]호산나 찬양대", aliases: ["호산나 찬양대"] },
  { id: 90009, title: "[주일 3부]시온 찬양대", aliases: ["시온 찬양대"] },
  { id: 90010, title: "[주일 찬양팀]조이언스", aliases: ["조이언스"] },
  { id: 90011, title: "[수요 찬양팀]디사이플스", aliases: ["디사이플스"] },
  { id: 90015, title: "[금요 찬양팀]카리스", aliases: ["카리스"] },
  { id: 90016, title: "[청년부 찬양팀]리빌드", aliases: ["리빌드"] },
  { id: 90017, title: "예배특송", aliases: ["특송", "예배 특송"] },
];

function normalizePlaylistMenuLabel(label: string) {
  return label.replace(/\s+/g, "").toLowerCase();
}

function findDefinition(playlistId: number, playlistTitle: string) {
  const byId = JOYFUL_TV_THIRD_LEVEL_PLAYLISTS.find((definition) => definition.id === playlistId);
  if (byId) return byId;

  const normalizedTitle = normalizePlaylistMenuLabel(playlistTitle);
  return JOYFUL_TV_THIRD_LEVEL_PLAYLISTS.find((definition) =>
    [definition.title, ...definition.aliases]
      .some((label) => normalizePlaylistMenuLabel(label) === normalizedTitle),
  );
}

export function getCanonicalJoyfulTvPlaylistTitle(playlistId: number, playlistTitle: string) {
  return findDefinition(playlistId, playlistTitle)?.title ?? playlistTitle;
}

export function getJoyfulTvPlaylistLinkLabels(playlistId: number, playlistTitle: string) {
  const definition = findDefinition(playlistId, playlistTitle);
  return definition
    ? [playlistTitle, definition.title, ...definition.aliases]
    : [playlistTitle];
}

export function matchesJoyfulTvPlaylistMenuLabel(
  menuLabel: string,
  playlistId: number,
  playlistTitle: string,
) {
  const normalizedMenuLabel = normalizePlaylistMenuLabel(menuLabel);
  return getJoyfulTvPlaylistLinkLabels(playlistId, playlistTitle)
    .some((label) => normalizePlaylistMenuLabel(label) === normalizedMenuLabel);
}
