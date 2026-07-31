-- Restore the verified legacy sermon metadata for YouTube video 72UhzpTPkXI.
-- Source: legacy Sunday sermon pageCode=422, num=12024, vodType=235.
UPDATE `youtube_videos`
SET
  `title` = '씨를 뿌린 대로 거둡니다',
  `preacher` = '박진석 담임목사',
  `scripture` = '시편 126:5-6 / 마가복음 4:14-20',
  `sermonDate` = '2025-10-26'
WHERE `id` = 97588
  AND `playlistId` = 60004
  AND `videoId` = '72UhzpTPkXI'
  AND `title` = '제목 없음'
  AND `sermonDate` IS NULL;
