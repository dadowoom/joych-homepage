UPDATE `youtube_videos`
SET
  `videoUrl` = CASE
    WHEN `playlistId` = 90001 AND `videoUrl` LIKE '%/api/legacy-vod/423/%/237.mp4'
      THEN CONCAT('http://sermon.joych.org/mp4/wed/', REPLACE(SUBSTRING(`sermonDate`, 3), '-', ''), '_wed.mp4')
    WHEN `playlistId` = 90002 AND `videoUrl` LIKE '%/api/legacy-vod/424/%/238.mp4'
      THEN CONCAT('http://sermon.joych.org/mp4/friday_night/', REPLACE(SUBSTRING(`sermonDate`, 3), '-', ''), '_fri.mp4')
    WHEN `playlistId` = 90003 AND `videoUrl` LIKE '%/api/legacy-vod/242/%/40.mp4'
      THEN CONCAT('http://sermon.joych.org/mp4/special/', REPLACE(SUBSTRING(`sermonDate`, 3), '-', ''), '_hyi.mp4')
    WHEN `playlistId` = 90004 AND `id` = 90025
      THEN 'http://sermon.joych.org/mp4/special/260412_testi_4.mp4'
    WHEN `playlistId` = 90004 AND `videoUrl` LIKE '%/api/legacy-vod/359/%/69.mp4'
      THEN CONCAT('http://sermon.joych.org/mp4/special/', REPLACE(SUBSTRING(`sermonDate`, 3), '-', ''), '_testi.mp4')
    WHEN `playlistId` = 90007 AND `id` = 90226
      THEN 'http://sermon.joych.org/mp4/hymn/240908_hymn1.mp4'
    WHEN `playlistId` = 90007 AND `id` = 90290
      THEN 'http://sermon.joych.org/mp4/hymn/230611_hymn1.mp4'
    WHEN `playlistId` = 90007 AND `videoUrl` LIKE '%/api/legacy-vod/192/%/19.mp4'
      THEN CONCAT('http://sermon.joych.org/mp4/hymn/', REPLACE(SUBSTRING(`sermonDate`, 3), '-', ''), '_hymn1.mp4')
    ELSE `videoUrl`
  END,
  `updatedAt` = CURRENT_TIMESTAMP
WHERE `sermonDate` REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  AND (
    (`playlistId` = 90001 AND `videoUrl` LIKE '%/api/legacy-vod/423/%/237.mp4') OR
    (`playlistId` = 90002 AND `videoUrl` LIKE '%/api/legacy-vod/424/%/238.mp4') OR
    (`playlistId` = 90003 AND `videoUrl` LIKE '%/api/legacy-vod/242/%/40.mp4') OR
    (`playlistId` = 90004 AND `videoUrl` LIKE '%/api/legacy-vod/359/%/69.mp4') OR
    (`playlistId` = 90007 AND `videoUrl` LIKE '%/api/legacy-vod/192/%/19.mp4')
  );
