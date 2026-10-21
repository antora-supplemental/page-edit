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
  svg = svg.replace(/<svg\b/, '<svg class="valentus-edit-vcs-svg" width="16" height="16" focusable="false" aria-hidden="true"')
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

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])

function isSelfClosingTag (tagName, openTagText) {
  if (/\/>\s*$/.test(openTagText)) return true
  return VOID_ELEMENTS.has(String(tagName).toLowerCase())
}

function findBalancedElementEnd (html, startIndex, tagName) {
  const lower = String(tagName).toLowerCase()
  const openMatch = /^<([a-zA-Z][\w:-]*)\b([^>]*?)(\/?)>/i.exec(html.slice(startIndex))
  if (!openMatch) return html.length
  const openLen = openMatch[0].length
  if (isSelfClosingTag(openMatch[1], openMatch[0])) return startIndex + openLen

  let depth = 1
  let pos = startIndex + openLen
  while (pos < html.length && depth > 0) {
    const rest = html.slice(pos)
    const nextOpen = /^<([a-zA-Z][\w:-]*)\b([^>]*?)(\/?)>/i.exec(rest)
    const nextClose = /^<\/([a-zA-Z][\w:-]*)\s*>/i.exec(rest)
    const openAt = nextOpen ? nextOpen.index : -1
    const closeAt = nextClose ? nextClose.index : -1

    if (nextOpen && openAt === 0 && closeAt !== 0) {
      if (!isSelfClosingTag(nextOpen[1], nextOpen[0]) && nextOpen[1].toLowerCase() === lower) depth += 1
      pos += nextOpen[0].length
      continue
    }
    if (nextClose && closeAt === 0) {
      if (nextClose[1].toLowerCase() === lower) depth -= 1
      pos += nextClose[0].length
      continue
    }
    pos += 1
  }
  return pos
}

function getAttrValue (openAttrs, name) {
  const re = new RegExp('\\b' + name + '\\s*=\\s*(["\'])([^"\']*)\\1', 'i')
  const m = openAttrs.match(re)
  return m ? m[2] : null
}

function findTitleBlockStartInFragment (fragment) {
  const m =
    /^\s*<div\b[^>]*\b(?:valentus|adt)-page-header\b[^>]*>/i.exec(fragment) ||
    /^\s*<h1\b/i.exec(fragment)
  return m ? m.index + (m[0].length - m[0].trimStart().length) : -1
}

function injectIntoHeaderZoneBeforeTitle (html, insertHtml) {
  const re = /<([a-zA-Z][\w:-]*)\b([^>]*?)(\/?)>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const tagName = m[1]
    const attrs = m[2]
    const openTag = m[0]
    if (isSelfClosingTag(tagName, openTag)) continue
    if (getAttrValue(attrs, 'data-zone') !== 'header') continue
    const start = m.index
    const end = findBalancedElementEnd(html, start, tagName)
    const closeMatch = /<\/([a-zA-Z][\w:-]*)\s*>$/i.exec(html.slice(start, end))
    if (!closeMatch) continue
    const innerStart = start + openTag.length
    const innerEnd = end - closeMatch[0].length
    const inner = html.slice(innerStart, innerEnd)
    const rel = findTitleBlockStartInFragment(inner)
    const insertAt = rel >= 0 ? innerStart + rel : innerStart
    return html.slice(0, insertAt) + insertHtml + html.slice(insertAt)
  }
  return null
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
 * Derive a forge edit URL from a read-only blob/view URL (inverse of {@link viewUrlFromEditUrl}).
 * Antora tag-pinned sources emit blob URLs in `src.editUrl` instead of `/edit/` links.
 * @param {string} viewUrl
 * @returns {string} empty when unknown
 */
function editUrlFromViewUrl (viewUrl) {
  const href = String(viewUrl || '').trim()
  if (!href || href.startsWith('file:')) return ''

  // GitHub / Gitea / Codeberg-style: /blob/ → /edit/
  let out = href.replace(/\/blob\//, '/edit/')
  if (out !== href) return out

  // GitLab: /-/blob/ → /-/edit/
  out = href.replace(/\/-\/blob\//, '/-/edit/')
  if (out !== href) return out

  // Bitbucket Cloud: /src/… → /src/…?mode=edit
  try {
    const u = new URL(href)
    if (/bitbucket\.org$/i.test(u.hostname) || /bitbucket\./i.test(u.hostname)) {
      if (u.pathname.includes('/src/') && u.searchParams.get('mode') !== 'edit') {
        u.searchParams.set('mode', 'edit')
        return u.toString()
      }
    }
  } catch {
    /* ignore */
  }

  return ''
}

/**
 * @param {string} href - Antora `src.editUrl` (edit or blob)
 * @param {string | null | undefined} [explicitViewHref]
 */
function resolveViewEditHrefs (href, explicitViewHref) {
  if (explicitViewHref != null) {
    return { viewHref: explicitViewHref, editHref: href }
  }
  const viewFromEdit = viewUrlFromEditUrl(href)
  if (viewFromEdit) {
    return { viewHref: viewFromEdit, editHref: href }
  }
  const editFromView = editUrlFromViewUrl(href)
  if (editFromView) {
    return { viewHref: href, editHref: editFromView }
  }
  return { viewHref: '', editHref: href }
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
  const { viewHref, editHref } = resolveViewEditHrefs(href, opts.viewHref)

  const parts = []
  if (viewHref) {
    parts.push(
      `<a class="valentus-view-inline-link" href="${escapeHtml(viewHref)}" ` +
        `title="View source" aria-label="View source" ` +
        `data-vcs-provider="${escapeHtml(iconId)}">View</a>`
    )
  }
  parts.push(
    `<a class="valentus-edit-inline-link" href="${escapeHtml(editHref)}" ` +
      `title="Edit this page" aria-label="Edit this page" data-vcs-provider="${escapeHtml(iconId)}">` +
      `<span class="valentus-edit-inline-text">${escapeHtml(editLabel)}</span>` +
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
 * Source line: "Source:" label, VCS mark, then View | Edit. Lives visually above the page
 * title in the header zone (never in the page-context metadata table).
 * @param {string} actionsHtml
 * @param {{ iconHtml?: string, iconId?: string }} [opts]
 */
function buildSourceLineHtml (actionsHtml, opts = {}) {
  const iconHtml = opts.iconHtml != null ? opts.iconHtml : buildSourceKeyIconHtml(opts.iconId)
  return (
    `<div class="page-context-source-line">` +
    `<span class="page-context-source-key">` +
    `<span class="page-context-source-label">Source:</span>${iconHtml}</span> ` +
    `${actionsHtml}</div>`
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
 * Insert the Source line (View | Edit) directly above the page title block, still in
 * `[data-zone="header"]` when zoned. Before any page-context lead (byline + metadata
 * table). One placement for every page — the Source line never joins the metadata table.
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
  // Real markup only - page-context CSS also names `.page-context-source-actions`.
  if (
    /<(?:div|p)\b[^>]*\bpage-context-source-line\b/i.test(html) ||
    /<tr\b[^>]*\bpage-context-source-row\b/i.test(html) ||
    /<(?:span|aside)\b[^>]*\bpage-context-source-actions\b/i.test(html) ||
    /<aside\b[^>]*\bpage-context-actions\b/i.test(html)
  ) {
    return html
  }

  const sourceLine = buildSourceLineHtml(actionsHtml, opts)

  const zoned = injectIntoHeaderZoneBeforeTitle(html, sourceLine)
  if (zoned) return zoned

  // Full composed page: insert inside the article column, before the title block.
  const articleOpen = /<article\b[^>]*\bclass="[^"]*\bdoc\b[^"]*"[^>]*>|<article\b[^>]*>/i
  const article = articleOpen.exec(html)
  if (article) {
    const at = article.index + article[0].length
    const rest = html.slice(at)
    const rel = findTitleBlockStartInFragment(rest)
    const insertAt = rel >= 0 ? at + rel : at
    return `${html.slice(0, insertAt)}${sourceLine}${html.slice(insertAt)}`
  }

  // Fragment (pre-compose): the theme renders the title above page.contents, so a
  // leading Source line still lands above the title and above the lead aside.
  if (!/<!DOCTYPE/i.test(html) && !/<html\b/i.test(html)) {
    return `${sourceLine}${html}`
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
  buildSourceLineHtml,
  injectEditActions,
  resolveEditTarget,
  viewUrlFromEditUrl,
  editUrlFromViewUrl,
  resolveViewEditHrefs,
  escapeHtml,
}
