'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { vcsIconIdFromUrl } = require('./vcs-icon-id')

const ICONS_DIR = path.join(__dirname, '..', 'icons')

/** @type {Map<string, string>} */
const cache = new Map()

function loadIconSvg (id) {
  if (cache.has(id)) return cache.get(id)
  const file = path.join(ICONS_DIR, `${id}.svg`)
  if (!fs.existsSync(file)) {
    cache.set(id, '')
    return ''
  }
  let svg = fs.readFileSync(file, 'utf8').trim()
  // Theme via CSS color; assets shipped white-fill for <img> filters.
  svg = svg.replace(/\sfill="#[0-9a-fA-F]{3,8}"/g, ' fill="currentColor"')
  svg = svg.replace(/<svg\b/, '<svg class="adt-edit-vcs-svg" width="16" height="16" focusable="false" aria-hidden="true"')
  cache.set(id, svg)
  return svg
}

function escapeHtml (text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Derive a read-only "View" (blob) URL from a forge edit URL when possible.
 * @param {string} editUrl
 * @returns {string} empty when unknown
 */
function viewUrlFromEditUrl (editUrl) {
  const href = String(editUrl || '').trim()
  if (!href || href.startsWith('file:')) return ''

  // GitHub / Gitea / Codeberg-style: /edit/ → /blob/
  let out = href.replace(/\/edit\//, '/blob/')
  if (out !== href) return out

  // GitLab: /-/edit/ → /-/blob/
  out = href.replace(/\/-\/edit\//, '/-/blob/')
  if (out !== href) return out

  // Bitbucket Cloud: /src/…?mode=edit → /src/…
  try {
    const u = new URL(href)
    if (/bitbucket\.org$/i.test(u.hostname) || /bitbucket\./i.test(u.hostname)) {
      u.searchParams.delete('mode')
      return u.toString()
    }
  } catch {
    /* ignore */
  }

  return ''
}

/**
 * VCS mark for the Source key cell (not a button; sits before the word "Source").
 * @param {string} [iconId]
 * @returns {string} inline SVG or empty
 */
function buildSourceKeyIconHtml (iconId) {
  const id = iconId || 'code'
  return loadIconSvg(id) || loadIconSvg('code') || loadIconSvg('repo') || ''
}

/**
 * Build text-only View | Edit cell HTML (no VCS icon on either link).
 * @param {{ href: string, iconId?: string, viewHref?: string, label?: string }} opts
 */
function buildEditActionsHtml (opts) {
  const href = opts && opts.href
  if (!href) return ''
  const iconId = opts.iconId || vcsIconIdFromUrl(href, 'code')
  const editLabel = opts.label || 'Edit'
  const viewHref = opts.viewHref != null ? opts.viewHref : viewUrlFromEditUrl(href)

  const parts = []
  if (viewHref) {
    parts.push(
      `<a class="adt-view-inline-link" href="${escapeHtml(viewHref)}" ` +
        `title="View source" aria-label="View source" ` +
        `data-vcs-provider="${escapeHtml(iconId)}">View</a>`
    )
  }
  parts.push(
    `<a class="adt-edit-inline-link" href="${escapeHtml(href)}" ` +
      `title="Edit this page" aria-label="Edit this page" data-vcs-provider="${escapeHtml(iconId)}">` +
      `<span class="adt-edit-inline-text">${escapeHtml(editLabel)}</span>` +
      `</a>`
  )
  const sep = viewHref ? `<span class="page-context-source-sep" aria-hidden="true">|</span>` : ''
  const links = viewHref ? `${parts[0]}${sep}${parts[1]}` : parts[0]

  return (
    `<span class="page-context-source-actions" data-vcs-provider="${escapeHtml(iconId)}">` +
    `${links}</span>`
  )
}

/**
 * Lead-table Source row: icon + "Source" in the key cell; View | Edit in the value cell.
 * @param {string} actionsHtml
 * @param {{ iconHtml?: string, iconId?: string }} [opts]
 */
function buildSourceRowHtml (actionsHtml, opts = {}) {
  const iconHtml = opts.iconHtml != null ? opts.iconHtml : buildSourceKeyIconHtml(opts.iconId)
  return (
    `<tr class="page-context-source-row">` +
    `<th scope="row" class="page-context-source-key">` +
    `${iconHtml}<span class="page-context-source-label">Source</span></th>` +
    `<td>${actionsHtml}</td></tr>`
  )
}

/**
 * Legacy floating aside markup (tests / older themes). Prefer table-row inject.
 * @param {{ href: string, iconId?: string, viewHref?: string, label?: string }} opts
 */
function buildEditActionsAsideHtml (opts) {
  const inner = buildEditActionsHtml(opts)
  if (!inner) return ''
  const iconId = (opts && opts.iconId) || vcsIconIdFromUrl(opts && opts.href, 'code')
  const icon = buildSourceKeyIconHtml(iconId)
  // Legacy aside: keep a single mark before the text links (not on Edit).
  return (
    `<aside class="page-context page-context-actions" role="note">` +
    `<span class="page-context-source-key">${icon}</span>${inner}</aside>`
  )
}

/**
 * Build a lead-zone panel that holds only the Source row (header zone for page-edit).
 * @param {string} sourceRow
 */
function buildLeadSourcePanelHtml (sourceRow) {
  return (
    `<aside class="page-context page-context-lead" role="note">` +
    `<div class="page-context-panel">` +
    `<table class="page-context-table"><tbody>${sourceRow}</tbody></table>` +
    `</div></aside>`
  )
}

/**
 * Insert View|Edit as a lead-table Source row, or fall back inside the article column.
 * Preserves a lead byline sibling outside `.page-context-panel` / `<table>`.
 *
 * Antora's `pagesComposed` runs after UI compose, so `page.contents` is often a full
 * HTML document. Never prepend to the document start (that puts View|Edit above
 * `<!DOCTYPE>` / the top navbar).
 *
 * @param {string} html
 * @param {string} actionsHtml - inner `.page-context-source-actions` HTML
 * @param {{ iconHtml?: string, iconId?: string }} [opts]
 */
function injectEditActions (html, actionsHtml, opts = {}) {
  if (!html || !actionsHtml) return html
  if (/\bpage-context-source-actions\b/.test(html) || /\bpage-context-actions\b/.test(html)) {
    return html
  }

  const sourceRow = buildSourceRowHtml(actionsHtml, opts)

  // Prefer appending inside an existing lead table body (panel or bare).
  const leadTableBody =
    /(<aside\b[^>]*\bpage-context-lead\b[^>]*>[\s\S]*?<table\b[^>]*\bpage-context-table\b[^>]*>\s*<tbody>)([\s\S]*?)(<\/tbody>)/i
  if (leadTableBody.test(html)) {
    return html.replace(leadTableBody, (_, open, rows, close) => `${open}${rows}${sourceRow}${close}`)
  }

  // Lead aside without a table (byline-only): add an inner panel + one-row table.
  const leadOpen = /(<aside\b[^>]*\bpage-context-lead\b[^>]*>)([\s\S]*?)(<\/aside>)/i
  if (leadOpen.test(html)) {
    const panel =
      `<div class="page-context-panel">` +
      `<table class="page-context-table"><tbody>${sourceRow}</tbody></table>` +
      `</div>`
    return html.replace(leadOpen, (_, open, inner, close) => `${open}${inner}${panel}${close}`)
  }

  const leadPanel = buildLeadSourcePanelHtml(sourceRow)

  // Full composed page: insert lead zone inside the article column (never before DOCTYPE).
  const afterPageHeader =
    /(<article\b[^>]*\bclass="[^"]*\bdoc\b[^"]*"[^>]*>\s*(?:<div\b[^>]*\badt-page-header\b[^>]*>[\s\S]*?<\/div>\s*)?)/i
  if (afterPageHeader.test(html)) {
    return html.replace(afterPageHeader, (_, open) => `${open}${leadPanel}`)
  }
  const afterArticle = /(<article\b[^>]*>)/i
  if (afterArticle.test(html)) {
    return html.replace(afterArticle, (_, open) => `${open}${leadPanel}`)
  }

  // Fragment without lead (pre-compose): prepend a lead shell, not a floating legacy aside.
  if (!/<!DOCTYPE/i.test(html) && !/<html\b/i.test(html)) {
    return `${leadPanel}${html}`
  }

  // Last resort on a full document with no article: legacy aside before </body>.
  if (/<\/body>/i.test(html)) {
    return html.replace(
      /<\/body>/i,
      `<aside class="page-context page-context-actions" role="note">${actionsHtml}</aside></body>`
    )
  }
  return html
}

/**
 * Resolve Antora page edit URL + whether it should be shown.
 * @param {object} page - content catalog page file
 * @param {{ forceShow?: boolean, allowFileUri?: boolean, isCi?: boolean }} [opts]
 */
function resolveEditTarget (page, opts = {}) {
  const forceShow = !!opts.forceShow
  const allowFileUri = opts.allowFileUri !== false
  const isCi = !!opts.isCi
  const origin = page.src && page.src.origin
  const privateOrigin = !!(origin && origin.private)
  const editUrl =
    (page.src && (page.src.editUrl || page.editUrl)) ||
    page.editUrl ||
    ''
  if (editUrl && (forceShow || !privateOrigin)) {
    return { href: String(editUrl), kind: 'editUrl' }
  }
  const fileUri = (page.src && page.src.fileUri) || page.fileUri || ''
  // Local file edit is workstation preview only (never CI; never private origins).
  if (allowFileUri && fileUri && !isCi && !privateOrigin) {
    return { href: String(fileUri), kind: 'fileUri' }
  }
  return null
}

module.exports = {
  loadIconSvg,
  buildSourceKeyIconHtml,
  buildEditActionsHtml,
  buildEditActionsAsideHtml,
  buildSourceRowHtml,
  buildLeadSourcePanelHtml,
  injectEditActions,
  resolveEditTarget,
  viewUrlFromEditUrl,
  escapeHtml,
}
