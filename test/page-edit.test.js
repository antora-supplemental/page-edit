'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  vcsIconIdFromUrl,
  adtVcsIconIdHelper,
  buildEditActionsHtml,
  injectEditActions,
  resolveEditTarget,
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

  it('Handlebars helper ignores options object as second arg', () => {
    assert.equal(adtVcsIconIdHelper('https://github.com/a/b', { hash: {}, data: {} }), 'github')
    assert.equal(adtVcsIconIdHelper('https://gitlab.com/a/b', 'repo'), 'gitlab')
  })

  it('bakes inline SVG into edit actions HTML', () => {
    const html = buildEditActionsHtml({
      href: 'https://github.com/org/repo/edit/main/pages/index.adoc',
      iconId: 'github',
    })
    assert.match(html, /page-context-actions/)
    assert.match(html, /adt-edit-inline-link/)
    assert.match(html, /data-vcs-provider="github"/)
    assert.match(html, /<svg[^>]*class="adt-edit-vcs-svg"/)
    assert.match(html, /currentColor/)
    assert.match(html, /Edit this page/)
    assert.doesNotMatch(html, /site-vcs-icons/)
  })

  it('injects into page-context-lead when present', () => {
    const body =
      '<aside class="page-context page-context-lead" role="note"><table></table></aside><p>Hi</p>'
    const actions = buildEditActionsHtml({ href: 'https://github.com/o/r/edit/main/a.adoc' })
    const out = injectEditActions(body, actions)
    assert.match(out, /page-context-lead" role="note"><aside class="page-context page-context-actions"/)
    assert.match(out, /<table><\/table>/)
    assert.equal(injectEditActions(out, actions), out)
  })

  it('prepends actions when no lead aside', () => {
    const out = injectEditActions('<p>Hi</p>', buildEditActionsHtml({ href: 'https://github.com/o/r/edit/main/a.adoc' }))
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
