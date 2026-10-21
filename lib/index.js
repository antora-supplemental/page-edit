'use strict'

/**
 * Antora extension: bake a Source line (View | Edit) under the page title, ahead of the page-context lead.
 *
 * Provider mark is chosen at build time from the edit/file URL (no runtime JS).
 * Themes style `.page-context-source-actions` / `.valentus-edit-inline-link`; Valentus is one consumer.
 *
 * Also exports `vcsIconIdFromUrl` for UI helpers (header repo mark, etc.).
 */

const { vcsIconIdFromUrl, adtVcsIconIdHelper } = require('./vcs-icon-id')
const {
  buildEditActionsHtml,
  buildEditActionsAsideHtml,
  buildSourceKeyIconHtml,
  buildSourceLineHtml,
  injectEditActions,
  resolveEditTarget,
  viewUrlFromEditUrl,
  editUrlFromViewUrl,
  resolveViewEditHrefs,
  loadIconSvg,
} = require('./edit-actions')

function register (context = {}) {
  const config = context.config || {}
  const forceShow =
    config.forceShow === true ||
    String(process.env.FORCE_SHOW_EDIT_PAGE_LINK || '') === 'true'
  const isCi = String(process.env.CI || '') === 'true'
  const logger = this.getLogger('@antora-supplemental/page-edit')

  this.on('pagesComposed', ({ contentCatalog }) => {
    let injected = 0
    for (const page of contentCatalog.getPages((p) => p.out)) {
      const target = resolveEditTarget(page, { forceShow, isCi })
      if (!target) continue
      const iconId = vcsIconIdFromUrl(
        target.href,
        target.kind === 'fileUri' ? 'code' : 'code'
      )
      const actionsHtml = buildEditActionsHtml({
        href: target.href,
        viewHref: target.kind === 'fileUri' ? '' : viewUrlFromEditUrl(target.href),
        iconId,
      })
      if (!actionsHtml) continue
      const before = page.contents.toString()
      const after = injectEditActions(before, actionsHtml, {
        iconHtml: buildSourceKeyIconHtml(iconId),
        iconId,
      })
      if (after === before) continue
      page.contents = Buffer.from(after)
      injected++
    }
    if (injected) logger.info(`Injected View|Edit source control on ${injected} page(s)`)
  })
}

module.exports = register
module.exports.register = register
module.exports.vcsIconIdFromUrl = vcsIconIdFromUrl
module.exports.adtVcsIconIdHelper = adtVcsIconIdHelper
module.exports._internal = {
  vcsIconIdFromUrl,
  adtVcsIconIdHelper,
  loadIconSvg,
  buildSourceKeyIconHtml,
  buildEditActionsHtml,
  buildEditActionsAsideHtml,
  buildSourceLineHtml,
  injectEditActions,
  resolveEditTarget,
  viewUrlFromEditUrl,
  editUrlFromViewUrl,
  resolveViewEditHrefs,
}
