CREATE TABLE IF NOT EXISTS `mission_report_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reportId` int NOT NULL,
  `fileName` varchar(256) NOT NULL,
  `fileUrl` varchar(512) NOT NULL,
  `fileSize` int,
  `mimeType` varchar(128),
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `mission_report_files_id` PRIMARY KEY (`id`)
);

