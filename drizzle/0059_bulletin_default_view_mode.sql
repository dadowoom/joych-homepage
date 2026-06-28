INSERT INTO site_settings (settingKey, settingValue, description)
VALUES (
  'bulletin_default_view_mode',
  'list',
  '주보보기 기본 보기방식 (list/grid)'
)
ON DUPLICATE KEY UPDATE
  settingKey = settingKey;
