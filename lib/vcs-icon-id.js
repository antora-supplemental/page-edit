'use strict'

/**
 * Map a repository or edit URL hostname to a VCS icon id.
 * @param {string} [url]
 * @param {string} [unknownId='code']
 * @returns {string}
 */
function vcsIconIdFromUrl (url, unknownId) {
  const fallback = unknownId || 'code'
  if (!url) return fallback
  let host
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return fallback
  }
  if (
    host === 'github.com' ||
    host === 'raw.githubusercontent.com' ||
    host === 'github.dev' ||
    host.endsWith('.github.com')
  ) {
    return 'github'
  }
  if (host === 'bitbucket.org' || host.includes('bitbucket.')) return 'bitbucket'
  if (host.includes('gitlab')) return 'gitlab'
  if (host === 'codeberg.org' || host.endsWith('.codeberg.page') || host.endsWith('.codeberg.org')) {
    return 'codeberg'
  }
  if (host.includes('gitea')) return 'gitea'
  if (host.includes('forgejo')) return 'forgejo'
  if (host.includes('sourcehut') || host.endsWith('sr.ht') || host === 'git.sr.ht') {
    return 'sourcehut'
  }
  return fallback
}

/**
 * Handlebars-friendly helper (Antora UI helpers receive options as last arg).
 * Usage: {{adt-vcs-icon-id page.editUrl}} or {{adt-vcs-icon-id page.origin.webUrl 'repo'}}
 */
function adtVcsIconIdHelper (url, unknownIdOrOptions) {
  const unknownId =
    typeof unknownIdOrOptions === 'string' ? unknownIdOrOptions : 'code'
  return vcsIconIdFromUrl(url, unknownId)
}

module.exports = {
  vcsIconIdFromUrl,
  adtVcsIconIdHelper,
}
