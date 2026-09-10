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
  svg = svg.replace(/<svg\b/, '<svg class="adt-edit-vcs-svg" width="16" height="16" focusable="false"')
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
 * Build the edit-action aside HTML (baked provider mark; no runtime JS).
 * @param {{ href: string, iconId?: string, label?: string }} opts
 */
function buildEditActionsHtml (opts) {
  const href = opts && opts.href
  if (!href) return ''
  const iconId = opts.iconId || vcsIconIdFromUrl(href, 'code')
  const label = opts.label || 'Edit'
  const svg = loadIconSvg(iconId) || loadIconSvg('code') || loadIconSvg('repo')
  const icon = svg || ''
  return (
    `<aside class="page-context page-context-actions" role="note">` +
    `<a class="adt-edit-inline-link" href="${escapeHtml(href)}" ` +
    `title="Edit this page" aria-label="Edit this page" data-vcs-provider="${escapeHtml(iconId)}">` +
    `${icon}<span class="adt-edit-inline-text">${escapeHtml(label)}</span>` +
    `</a></aside>`
  )
}

/**
 * Insert actions into an existing page-context-lead aside, or prepend a standalone aside.
 * @param {string} html
 * @param {string} actionsHtml
 */
function injectEditActions (html, actionsHtml) {
  if (!html || !actionsHtml) return html
  if (/\bpage-context-actions\b/.test(html)) return html
  const leadOpen = /(<aside\b[^>]*\bpage-context-lead\b[^>]*>)/i
  if (leadOpen.test(html)) {
    // Place the edit control as the first child inside the lead panel.
    return html.replace(leadOpen, `$1${actionsHtml}`)
  }
  return actionsHtml + html
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
  buildEditActionsHtml,
  injectEditActions,
  resolveEditTarget,
  escapeHtml,
}
