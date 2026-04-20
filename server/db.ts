/**
 * DB 함수 진입점 (server/db.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 이 파일은 하위 호환성을 위해 유지됩니다.
 * 실제 구현은 server/db/ 폴더의 각 파일에 분리되어 있습니다.
 *
 * 기존 코드에서 `import { ... } from '../db'` 또는 `import { ... } from './db'`
 * 형태로 import하던 모든 코드가 그대로 동작합니다.
 *
 * 새로운 코드를 작성할 때는 아래 경로에서 직접 import하는 것을 권장합니다:
 *   import { getDb } from './db/connection';
 *   import { getVisibleMenus } from './db/menu';
 *   import { getAllYoutubePlaylists } from './db/youtube';
 *   ... 등
 */

export * from "./db/index";
