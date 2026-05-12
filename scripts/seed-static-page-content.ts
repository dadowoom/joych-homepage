/**
 * 기존 코드 기반 페이지 콘텐츠를 CMS 저장값(site_settings static_page:*)으로 복사합니다.
 *
 * 실행:
 *   pnpm cms:seed-static-pages
 *   pnpm cms:seed-static-pages -- --force   # 기존 CMS 저장값까지 코드 기본값으로 덮어쓰기
 */
import "dotenv/config";
import { STATIC_PAGE_SEEDS } from "../shared/staticPageContent";
import { getStaticPageContentByHref, upsertStaticPageContent } from "../server/db";

const force = process.argv.includes("--force");

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const page of STATIC_PAGE_SEEDS) {
    const existing = await getStaticPageContentByHref(page.href);
    if (existing && !force) {
      skipped += 1;
      continue;
    }

    await upsertStaticPageContent(page.href, page.content);
    inserted += 1;
  }

  console.log(`CMS 페이지 콘텐츠 seed 완료: 저장 ${inserted}건, 건너뜀 ${skipped}건${force ? " (force)" : ""}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
