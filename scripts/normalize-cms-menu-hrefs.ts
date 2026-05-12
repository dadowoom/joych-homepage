import "dotenv/config";
import {
  makeUniqueMenuPageHref,
  type MenuHrefCandidate,
  type MenuHrefOwner,
} from "../server/_core/menuHref";
import {
  getAllMenus,
  updateMenuItem,
  updateMenuSubItem,
} from "../server/db";

const NUMERIC_ITEM_HREF_RE = /^\/page\/item\/\d+$/;
const NUMERIC_SUB_HREF_RE = /^\/page\/sub\/\d+$/;

type MenuTree = Awaited<ReturnType<typeof getAllMenus>>;

function collectMenuHrefs(tree: MenuTree): MenuHrefCandidate[] {
  return tree.flatMap((menu) => [
    { href: menu.href },
    ...(menu.items ?? []).flatMap((item) => [
      { href: item.href, owner: { kind: "item", id: item.id } as MenuHrefOwner },
      ...(((item as { subItems?: Array<{ id: number; href?: string | null }> }).subItems ?? [])
        .map(sub => ({
          href: sub.href,
          owner: { kind: "sub", id: sub.id } as MenuHrefOwner,
        }))),
    ]),
  ]);
}

async function normalize() {
  const tree = await getAllMenus();
  let updatedCount = 0;
  const existing = collectMenuHrefs(tree);

  for (const menu of tree) {
    for (const item of menu.items ?? []) {
      if (item.href && !NUMERIC_ITEM_HREF_RE.test(item.href)) {
        continue;
      }

      const href = makeUniqueMenuPageHref(
        [menu.label, item.label],
        existing,
        { kind: "item", id: item.id },
      );
      await updateMenuItem(item.id, { href });
      existing.push({ href, owner: { kind: "item", id: item.id } });
      updatedCount += 1;
      console.log(`item:${item.id} ${item.href ?? "(empty)"} -> ${href}`);
    }

    for (const item of menu.items ?? []) {
      for (const sub of (item as { subItems?: Array<{ id: number; label: string; href?: string | null }> }).subItems ?? []) {
        if (sub.href && !NUMERIC_SUB_HREF_RE.test(sub.href)) {
          continue;
        }

        const href = makeUniqueMenuPageHref(
          [menu.label, item.label, sub.label],
          existing,
          { kind: "sub", id: sub.id },
        );
        await updateMenuSubItem(sub.id, { href });
        existing.push({ href, owner: { kind: "sub", id: sub.id } });
        updatedCount += 1;
        console.log(`sub:${sub.id} ${sub.href ?? "(empty)"} -> ${href}`);
      }
    }
  }

  console.log(`normalized ${updatedCount} CMS menu href(s)`);
}

normalize()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
