// ==================================================================
// LAYER: PAPER (PAGE BACKGROUND)
// ------------------------------------------------------------------

import { attrs } from '../svg.mjs';

export default {
  id     : 'paper',
  space  : 'page',
  enabled: style => Boolean(style.page?.color),
  render : ctx => `<rect${attrs({
    id    : 'paper',
    width : ctx.page.widthMm,
    height: ctx.page.heightMm,
    fill  : ctx.style.page.color,
  })}/>`,
};
