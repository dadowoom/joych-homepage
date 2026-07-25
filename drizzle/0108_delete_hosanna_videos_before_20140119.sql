-- Keep the 2014-01-19 service and all newer Hosanna choir videos.
DELETE FROM `youtube_videos`
WHERE `playlistId` = 90008
  AND `sermonDate` < '2014-01-19';
