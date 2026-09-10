---
name: "Page edit"
description: "Bake Edit + VCS provider mark into the page-context lead zone at Antora build time (no runtime icon JS)."
---

# Overview

Valentus historically picked provider icons in the browser (`site-vcs-icons.js`) and parked **Edit** in the breadcrumb mast. For Antora, provider and edit URL are already known at generate time.

This **Antora extension** injects a baked Edit control into the page-context lead panel and exports the same hostname→icon mapping for optional UI helpers (header repo button).

## Install

```bash
pnpm add -D github:antora-supplemental/page-edit#main
```

## Playbook

```yaml
antora:
  extensions:
    - '@antora-supplemental/page-edit'
```

Pairs with `@antora-supplemental/page-context` (asciidoc.extensions) and a theme that styles `.page-context-actions`.
