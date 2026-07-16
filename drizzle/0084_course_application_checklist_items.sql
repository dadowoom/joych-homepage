CREATE TABLE IF NOT EXISTS `course_application_checklist_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `courseId` int NOT NULL,
  `itemKey` varchar(64) NOT NULL,
  `label` varchar(80) NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `course_checklist_items_course_key_unique` (`courseId`, `itemKey`),
  KEY `course_checklist_items_course_sort_idx` (`courseId`, `isActive`, `sortOrder`)
);

CREATE TABLE IF NOT EXISTS `course_application_checklist_values` (
  `id` int NOT NULL AUTO_INCREMENT,
  `applicationId` int NOT NULL,
  `itemKey` varchar(64) NOT NULL,
  `checked` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `course_checklist_values_application_key_unique` (`applicationId`, `itemKey`),
  KEY `course_checklist_values_application_idx` (`applicationId`)
);
