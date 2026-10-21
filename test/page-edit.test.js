'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  vcsIconIdFromUrl,
  adtVcsIconIdHelper,
  buildEditActionsHtml,
  buildSourceLineHtml,
  injectEditActions,
  resolveEditTarget,
  viewUrlFromEditUrl,
  editUrlFromViewUrl,
} = require('../lib/index.js')._internal

describe('page-edit', () => {
  it('maps hostnames to provider icon ids', () => {
    assert.equal(vcsIconIdFromUrl('https://github.com/org/repo/edit/main/x.adoc'), 'github')
    assert.equal(vcsIconIdFromUrl('https://gitlab.com/org/repo/-/edit/main/x.adoc'), 'gitlab')
    assert.equal(vcsIconIdFromUrl('https://bitbucket.org/org/repo/src/main/x.adoc'), 'bitbucket')
    assert.equal(vcsIconIdFromUrl('https://codeberg.org/org/repo/_edit/main/x.adoc'), 'codeberg')
    assert.equal(vcsIconIdFromUrl('https://git.example.com/x', 'repo'), 'repo')
    assert.equal(vcsIconIdFromUrl('file:///C:/code/x.adoc', 'code'), 'code')
  })

  it('derives View (blob) URLs from Edit URLs', () => {
    assert.equal(
      viewUrlFromEditUrl('https://github.com/org/repo/edit/main/pages/index.adoc'),
      'https://github.com/org/repo/blob/main/pages/index.adoc'
    )
    assert.equal(
      viewUrlFromEditUrl('https://gitlab.com/org/repo/-/edit/main/pages/index.adoc'),
      'https://gitlab.com/org/repo/-/blob/main/pages/index.adoc'
    )
    assert.equal(viewUrlFromEditUrl('file:///C:/code/x.adoc'), '')
  })

  it('derives Edit URLs from View (blob) URLs for tag-pinned Antora sources', () => {
    assert.equal(
      editUrlFromViewUrl(
        'https://github.com/antora-supplemental/demo-data/blob/v0.3.5/docs/demo-pages/modules/ROOT/pages/admonitions.adoc'
      ),
      'https://github.com/antora-supplemental/demo-data/edit/v0.3.5/docs/demo-pages/modules/ROOT/pages/admonitions.adoc'
    )
    assert.equal(
      editUrlFromViewUrl('https://gitlab.com/org/repo/-/blob/v1.0.0/pages/index.adoc'),
      'https://gitlab.com/org/repo/-/edit/v1.0.0/pages/index.adoc'
    )
    assert.equal(editUrlFromViewUrl('file:///C:/code/x.adoc'), '')
  })

  it('bakes View | Edit when Antora supplies a blob URL in src.editUrl', () => {
    const blob =
      'https://github.com/antora-supplemental/demo-data/blob/v0.3.5/docs/demo-pages/modules/ROOT/pages/admonitions.adoc'
    const html = buildEditActionsHtml({ href: blob, iconId: 'github' })
    assert.match(html, /valentus-view-inline-link[^>]+href="[^"]*\/blob\/v0\.3\.5\//)
    assert.match(html, /valentus-edit-inline-link[^>]+href="[^"]*\/edit\/v0\.3\.5\//)
    assert.match(html, />View</)
    const viewIdx = html.indexOf('>View<')
    const editIdx = html.indexOf('valentus-edit-inline-link')
    assert.ok(viewIdx > -1 && editIdx > viewIdx, 'View must precede Edit')
  })

  it('Handlebars helper ignores options object as second arg', () => {
    assert.equal(adtVcsIconIdHelper('https://github.com/a/b', { hash: {}, data: {} }), 'github')
    assert.equal(adtVcsIconIdHelper('https://gitlab.com/a/b', 'repo'), 'gitlab')
  })

  it('bakes text-only View | Edit into source-actions HTML', () => {
    const html = buildEditActionsHtml({
      href: 'https://github.com/org/repo/edit/main/pages/index.adoc',
      iconId: 'github',
    })
    assert.match(html, /page-context-source-actions/)
    assert.match(html, /valentus-view-inline-link/)
    assert.match(html, /valentus-edit-inline-link/)
    assert.match(html, /\/blob\/main\/pages\/index\.adoc/)
    assert.match(html, />View</)
    assert.match(html, /data-vcs-provider="github"/)
    assert.match(html, /Edit this page/)
    assert.doesNotMatch(html, /valentus-edit-vcs-svg/)
    assert.doesNotMatch(html, /site-vcs-icons/)
    const viewIdx = html.indexOf('>View<')
    const editIdx = html.indexOf('valentus-edit-inline-link')
    assert.ok(viewIdx > -1 && editIdx > viewIdx, 'View must precede Edit')
  })

  it('puts VCS icon on the Source label, not on Edit', () => {
    const actions = buildEditActionsHtml({
      href: 'https://github.com/org/repo/edit/main/pages/index.adoc',
      iconId: 'github',
    })
    const line = buildSourceLineHtml(actions, { iconId: 'github' })
    assert.match(line, /^<div class="page-context-source-line">/)
    assert.match(line, /page-context-source-key/)
    assert.match(line, /page-context-source-label">Source:</)
    assert.match(line, /page-context-source-key[^>]*>[\s\S]*Source:[\s\S]*valentus-edit-vcs-svg/)
    assert.doesNotMatch(line, /valentus-edit-inline-link[\s\S]*valentus-edit-vcs-svg/)
    assert.doesNotMatch(line, /<tr|<th|<td|<table/)
    assert.match(line, /page-context-source-actions[\s\S]*>View</)
  })

  const actions = buildEditActionsHtml({ href: 'https://github.com/o/r/edit/main/a.adoc' })
  const leadAside =
    '<aside class="page-context page-context-lead" role="note">' +
    '<p class="page-context-byline">Last updated</p>' +
    '<div class="page-context-panel">' +
    '<table class="page-context-table"><tbody>' +
    '<tr><th scope="row">Audience</th><td>Readers</td></tr>' +
    '</tbody></table></div></aside>'
  const composed = (inner) =>
    '<!DOCTYPE html><html><body><header class="header">Nav</header>' +
    '<article class="doc"><div class="valentus-page-header">\n  <h1 class="page valentus-page-title">Home</h1>\n</div>' +
    inner +
    '</article></body></html>'

  const composedZoned = (inner) =>
    '<!DOCTYPE html><html><body><header class="header">Nav</header>' +
    '<article class="doc" data-zone-root>' +
    '<header class="doc-zone doc-zone--header" data-zone="header">' +
    '<div class="valentus-page-header"><h1 class="page valentus-page-title">Home</h1></div>' +
    '</header>' +
    '<div class="doc-zone doc-zone--meta" data-zone="meta"></div>' +
    '<div class="doc-zone doc-zone--body" data-zone="body">' +
    inner +
    '</div></article></body></html>'

  it('injects Source line before the title inside data-zone header when zoned', () => {
    const out = injectEditActions(composedZoned(`${leadAside}<p>Body</p>`), actions, { iconId: 'github' })
    const header = out.match(/<header[^>]*data-zone="header"[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? ''
    assert.match(header, /page-context-source-line[\s\S]*valentus-page-header/)
    assert.doesNotMatch(header, /valentus-page-header[\s\S]*page-context-source-line/)
    assert.match(out, /data-zone="header"[\s\S]*page-context-source-line[\s\S]*<\/header>/)
    const body = out.match(/<div[^>]*data-zone="body"[^>]*>([\s\S]*?)<\/div>\s*<\/article>/)?.[1] ?? ''
    assert.doesNotMatch(body, /page-context-source-line/)
    assert.match(body, /page-context-lead/)
  })

  it('puts Source line above the title, before the lead, never in the table', () => {
    const out = injectEditActions(composed(`${leadAside}<p>Body</p>`), actions, { iconId: 'github' })
    assert.doesNotMatch(out, /page-context-source-row/)
    const table = out.match(/<table class="page-context-table"[\s\S]*?<\/table>/)[0]
    assert.doesNotMatch(table, /Source/)
    assert.match(table, /Audience/)
    const iSource = out.indexOf('page-context-source-line')
    const iTitleOpen = out.indexOf('valentus-page-header')
    const iLead = out.indexOf('page-context-lead')
    assert.ok(iSource > -1 && iTitleOpen > iSource && iLead > iTitleOpen, 'Source, title, lead')
    assert.equal(injectEditActions(out, actions), out)
  })

  it('uses the same placement when the page has no page-context lead', () => {
    const withLead = injectEditActions(composed(`${leadAside}<p>Body</p>`), actions)
    const noLead = injectEditActions(composed('<p>Body</p>'), actions)
    const order = (s) => [s.indexOf('page-context-source-line'), s.indexOf('valentus-page-header')]
    for (const out of [withLead, noLead]) {
      const [src, title] = order(out)
      assert.ok(src > -1 && title > src, 'Source line must precede the title block')
    }
    assert.doesNotMatch(noLead, /page-context-lead/)
    assert.match(noLead, /<div class="page-context-source-line">[\s\S]*<div class="valentus-page-header">[\s\S]*<p>Body<\/p>/)
    assert.equal(injectEditActions(noLead, actions), noLead)
  })

  it('finds the title block for legacy adt-page-header and bare h1', () => {
    const legacy =
      '<article class="doc"><div class="adt-page-header"><h1>T</h1></div><p>x</p></article>'
    assert.match(injectEditActions(legacy, actions), /<div class="page-context-source-line">[\s\S]*<div class="adt-page-header">/)
    const bare = '<article class="doc"><h1>T</h1><p>x</p></article>'
    assert.match(injectEditActions(bare, actions), /<div class="page-context-source-line">[\s\S]*<h1>T<\/h1>/)
    const none = '<article class="doc"><p>x</p></article>'
    assert.match(injectEditActions(none, actions), /<article class="doc"><div class="page-context-source-line">/)
  })

  it('prepends the Source line to a fragment without article', () => {
    const out = injectEditActions('<p>Hi</p>', actions)
    assert.match(out, /^<div class="page-context-source-line">/)
    assert.match(out, /<p>Hi<\/p>/)
  })

  it('never inserts before DOCTYPE on a full composed page', () => {
    const out = injectEditActions(composed('<p>Body</p>'), actions, { iconId: 'github' })
    assert.match(out, /^<!DOCTYPE html>/)
    assert.ok(out.indexOf('page-context-source-line') > out.indexOf('class="header"'))
  })
  it('resolves editUrl over fileUri and respects private origins', () => {
    const page = {
      src: {
        editUrl: 'https://github.com/o/r/edit/main/a.adoc',
        fileUri: 'file:///tmp/a.adoc',
        origin: { private: false },
      },
    }
    assert.equal(resolveEditTarget(page).href, page.src.editUrl)
    page.src.origin.private = true
    assert.equal(resolveEditTarget(page), null)
    assert.equal(resolveEditTarget(page, { forceShow: true }).href, page.src.editUrl)
    delete page.src.editUrl
    page.src.origin.private = false
    assert.equal(resolveEditTarget(page, { isCi: true }), null)
    assert.equal(resolveEditTarget(page, { isCi: false }).href, page.src.fileUri)
  })
  it('injects despite CSS that names source-actions', () => {
    const body =
      '<style type="text/css">.page-context-source-actions,.page-context-source-line{display:inline-flex}</style>' +
      '<article class="doc"><div class="valentus-page-header"><h1>T</h1></div></article>'
    const out = injectEditActions(body, actions, { iconId: 'github' })
    assert.match(out, /<div class="page-context-source-line">[\s\S]*<div class="valentus-page-header">/)
    assert.match(out, /valentus-view-inline-link/)
    assert.equal(injectEditActions(out, actions), out)
  })
})
