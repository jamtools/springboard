---
title: "Desktop App (Tauri)"
description: ""
summary: ""
date: 2023-09-07T16:13:18+02:00
lastmod: 2023-09-07T16:13:18+02:00
draft: false
weight: 100
toc: true
seo:
  title: "" # custom title (optional)
  description: "" # custom description (recommended)
  canonical: "" # custom canonical URL (optional)
  robots: "" # custom robot tags (optional)
---

Springboard's desktop app deployment uses [Tauri](https://v2.tauri.app) as the application shell, and can be deployed in 3 different ways:

- The desktop app hosts an http/websocket Hono server with the application for local devices to connect to and interact with (which is the primary use case of the Jam Tools framework). This is packaged as a [Node.js sidecar](https://v2.tauri.app/learn/sidecar-nodejs). The plan is to use Deno instead for greater [security options](https://docs.deno.com/runtime/fundamentals/security) during building/packaging.
- The desktop app acts as a client and connect to a remote server. The desktop app can run its actions locally or remotely, allowing each feature in the application to pivot when needed. In order to allow for local functionality, the UI is bundled into the Tauri app, as opposed to rendering a page served up by the remote server. We use Tauri's [updater](https://v2.tauri.app/plugin/updater) to keep the app updated with the version running on the remote server.
- The desktop app is an offline-only application that runs all of its actions in the Tauri webview.

To build the desktop app with CI, check out the workflows prefixed with `desktop` here [https://github.com/jamtools/springboard/tree/main/.github/workflows](https://github.com/jamtools/springboard/tree/main/.github/workflows). The workflow will scaffold a Tauri app during build time if one doesn't exist, resulting in a zero-config desktop app building process :rocket:
