CREATE TABLE IF NOT EXISTS `pastor_books` (
  `id` int AUTO_INCREMENT NOT NULL,
  `legacy_num` varchar(32),
  `title` varchar(255) NOT NULL,
  `summary` varchar(500),
  `content_html` text,
  `published_at` varchar(10),
  `external_url` text,
  `is_visible` boolean NOT NULL DEFAULT true,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `pastor_books_id` PRIMARY KEY(`id`),
  CONSTRAINT `pastor_books_legacy_num_unique` UNIQUE(`legacy_num`)
);

CREATE INDEX `pastor_books_visible_sort_idx` ON `pastor_books` (`is_visible`, `sort_order`);
CREATE INDEX `pastor_books_published_idx` ON `pastor_books` (`published_at`);

CREATE TABLE IF NOT EXISTS `pastor_book_images` (
  `id` int AUTO_INCREMENT NOT NULL,
  `book_id` int NOT NULL,
  `image_url` text NOT NULL,
  `file_key` varchar(512),
  `caption` varchar(128),
  `is_thumbnail` boolean NOT NULL DEFAULT false,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `pastor_book_images_id` PRIMARY KEY(`id`)
);

CREATE INDEX `pastor_book_images_book_order_idx` ON `pastor_book_images` (`book_id`, `is_thumbnail`, `sort_order`);

INSERT IGNORE INTO `pastor_books` (`legacy_num`, `title`, `published_at`, `external_url`, `sort_order`, `is_visible`) VALUES
('48406', '생선 아카데미 인간론⑧ 『하나님과 화목하라』 : 하나님의 주권과 인간의 자유의지', '2023.05.18', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=48406&page=0&keyfield=&key=&bCate=', 10, true),
('48405', '생선 아카데미 인간론⑦ 『고난을 이기는 법』 : 고난은 축복의 밑거름입니다', '2023.05.18', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=48405&page=0&keyfield=&key=&bCate=', 20, true),
('48202', '생선 아카데미 인간론⑥ 『영광에서 영광으로』 : 승리의 면류관을 얻는 방법', '2022.10.22', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=48202&page=0&keyfield=&key=&bCate=', 30, true),
('47951', '생선 아카데미 인간론⑤ 『그리스도로 옷 입은 사람』 : 하늘의 영광 속에 거하는 삶', '2022.09.25', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=47951&page=0&keyfield=&key=&bCate=', 40, true),
('47950', '생선 아카데미 인간론④ 『일하는 인간』 : 하나님나라 통치의 동역자', '2022.09.25', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=47950&page=0&keyfield=&key=&bCate=', 50, true),
('47519', '생선 아카데미 인간론③ 『푯대를 향하여』 : 그리스도인의 영적 성장 단계', '2022.02.03', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=47519&page=0&keyfield=&key=&bCate=', 60, true),
('47518', '생선 아카데미 인간론② 『토기장이와 그릇』 : 하나님의 절대주권과 인간의 사명', '2022.02.03', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=47518&page=0&keyfield=&key=&bCate=', 70, true),
('47517', '생선 아카데미 인간론① 『본향을 향하여』 : 인간은 어디로부터 와서 어디로 가는가?', '2022.02.03', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=47517&page=0&keyfield=&key=&bCate=', 80, true),
('47104', '열두 물멧돌', '2020.12.14', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=47104&page=0&keyfield=&key=&bCate=', 90, true),
('45367', '그의 기이한 빛으로 들어가라', '2019.03.21', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=45367&page=0&keyfield=&key=&bCate=', 100, true),
('34550', '실종된 천국을 회복하라', '2015.01.16', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=34550&page=0&keyfield=&key=&bCate=', 110, true),
('476', '은혜, 아직 끝나지 않았다.', '2013.03.30', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=476&page=0&keyfield=&key=&bCate=', 120, true),
('475', '받은 복을 세어 보아라', '2011.06.03', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=475&page=0&keyfield=&key=&bCate=', 130, true),
('474', '기독교 교육과 리더십', '2010.04.04', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=474&page=0&keyfield=&key=&bCate=', 140, true),
('473', '리더십 바톤터치', '2009.03.01', 'http://www.joych.org/main/sub.html?Mode=view&boardID=www12&num=473&page=0&keyfield=&key=&bCate=', 150, true);

INSERT INTO `pastor_book_images` (`book_id`, `image_url`, `is_thumbnail`, `sort_order`)
SELECT b.`id`, CONCAT('/pastor-books/', seed.`image_file`), true, 0
FROM `pastor_books` b
JOIN (
  SELECT '48406' AS `legacy_num`, '48406.png' AS `image_file`
  UNION ALL SELECT '48405', '48405.jpg'
  UNION ALL SELECT '48202', '48202.png'
  UNION ALL SELECT '47951', '47951.jpg'
  UNION ALL SELECT '47950', '47950.jpg'
  UNION ALL SELECT '47519', '47519.png'
  UNION ALL SELECT '47518', '47518.png'
  UNION ALL SELECT '47517', '47517.png'
  UNION ALL SELECT '47104', '47104.png'
  UNION ALL SELECT '45367', '45367.jpg'
  UNION ALL SELECT '34550', '34550.jpg'
  UNION ALL SELECT '476', '476.jpg'
  UNION ALL SELECT '475', '475.jpg'
  UNION ALL SELECT '474', '474.jpg'
  UNION ALL SELECT '473', '473.gif'
) seed ON seed.`legacy_num` = b.`legacy_num`
WHERE NOT EXISTS (
  SELECT 1
  FROM `pastor_book_images` i
  WHERE i.`book_id` = b.`id`
);
