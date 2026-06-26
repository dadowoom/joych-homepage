UPDATE `courses`
SET `imageUrl` = 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=900&h=1200&fit=crop&q=80'
WHERE `imageUrl` = 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&q=80'
  AND (`title` = '조이아카데미 문학강좌' OR `title` LIKE '%문학강좌%');
