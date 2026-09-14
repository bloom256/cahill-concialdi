// ==================================================================
// ROUND VIEW FOLDERS
// ------------------------------------------------------------------

// Builds flat folders in a round, one per view, where each variant's image is
// named after the variant:
//   by-view/overview/<variant>.png
//   by-view/<crop>/<variant>.png
// so an image viewer can step through all variants with the arrow keys.
// Files are hard links to the rendered images (no extra disk space), with a
// copy as fallback.

import { copyFile, link, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

// ------------------------------------------------------------------

async function linkOrCopy(source, target) {
  try {
    await link(source, target);
  }
  catch {
    await copyFile(source, target);
  }
}

// ------------------------------------------------------------------

// variants: [{ name, crops: [cropName, ...] }]
export async function writeRoundViews(roundDir, variants) {

  const viewsDir = join(roundDir, 'by-view');
  await rm(viewsDir, { recursive: true, force: true });

  const views = [['overview', name => join(roundDir, name, 'overview.png')]];
  variants[0].crops.forEach(crop => views.push([crop, name => join(roundDir, name, 'crops', `${crop}.png`)]));

  for (const [view, getSource] of views) {
    await mkdir(join(viewsDir, view), { recursive: true });
    for (const { name } of variants) await linkOrCopy(getSource(name), join(viewsDir, view, `${name}.png`));
  }
  return viewsDir;
}
