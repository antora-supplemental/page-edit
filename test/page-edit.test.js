'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  vcsIconIdFromUrl,
  adtVcsIconIdHelper,
  buildEditActionsHtml,
  buildSourceRowHtml,
  injectEditActions,
  resolveEditTarget,
  viewUrlFromEditUrl,
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
    assert.match(html, /adt-view-inline-link/)
    assert.match(html, /adt-edit-inline-link/)
    assert.match(html, /\/blob\/main\/pages\/index\.adoc/)
    assert.match(html, />View</)
    assert.match(html, /data-vcs-provider="github"/)
    assert.match(html, /Edit this page/)
    assert.doesNotMatch(html, /adt-edit-vcs-svg/)
    assert.doesNotMatch(html, /site-vcs-icons/)
    const viewIdx = html.indexOf('>View<')
    const editIdx = html.indexOf('adt-edit-inline-link')
    assert.ok(viewIdx > -1 && editIdx > viewIdx, 'View must precede Edit')
  })

  it('puts VCS icon on the Source key, not on Edit', () => {
    const actions = buildEditActionsHtml({
      href: 'https://github.com/org/repo/edit/main/pages/index.adoc',
      iconId: 'github',
    })
    const row = buildSourceRowHtml(actions, { iconId: 'github' })
    assert.match(row, /page-context-source-key/)
    assert.match(row, /page-context-source-label">Source</)
    assert.match(row, /<th[^>]*page-context-source-key[^>]*>[\s\S]*adt-edit-vcs-svg[\s\S]*Source/)
    assert.doesNotMatch(row, /adt-edit-inline-link[\s\S]*adt-edit-vcs-svg/)
    assert.match(row, /page-context-source-actions[\s\S]*>View</)
  })

  it('injects Source row into page-context-lead table', () => {
    const body =
      '<aside class="page-context page-context-lead" role="note">' +
      '<p class="page-context-byline">Last updated</p>' +
      '<div class="page-context-panel">' +
      '<table class="page-context-table"><tbody>' +
      '<tr><th scope="row">Audience</th><td>Readers</td></tr>' +
      '</tbody></table></div></aside><p>Hi</p>'
    const actions = buildEditActionsHtml({ href: 'https://github.com/o/r/edit/main/a.adoc' })
    const out = injectEditActions(body, actions, { iconId: 'github' })
    assert.match(out, /page-context-source-row/)
    assert.match(out, /page-context-source-key/)
    assert.match(out, /page-context-source-label">Source</)
    assert.match(out, /page-context-source-actions/)
    assert.match(out, /Audience/)
    assert.match(out, /page-context-byline/)
    const table = out.match(/<table class="page-context-table"[\s\S]*?<\/table>/)[0]
    assert.doesNotMatch(table, /page-context-byline/)
    assert.doesNotMatch(table, /Last updated/)
    assert.equal(injectEditActions(out, actions), out)
  })

  it('adds a panel+table when lead has byline but no table', () => {
    const body =
      '<aside class="page-context page-context-lead" role="note">' +
      '<p class="page-context-byline">Last updated</p></aside>'
    const actions = buildEditActionsHtml({ href: 'https://github.com/o/r/edit/main/a.adoc' })
    const out = injectEditActions(body, actions, { iconId: 'github' })
    assert.match(out, /page-context-panel/)
    assert.match(out, /page-context-table/)
    assert.match(out, /Source/)
    assert.match(
      out,
      /page-context-byline">Last updated<\/p><div class="page-context-panel">/
    )
  })

  it('prepends actions aside when no lead aside', () => {
    const out = injectEditActions(
      '<p>Hi</p>',
      buildEditActionsHtml({ href: 'https://github.com/o/r/edit/main/a.adoc' })
    )
    assert.match(out, /^<aside class="page-context page-context-actions"/)
    assert.match(out, /<p>Hi<\/p>/)
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
})
