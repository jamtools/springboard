---
title: "Overview"
description: ""
summary: ""
date: 2023-09-07T16:13:18+02:00
lastmod: 2023-09-07T16:13:18+02:00
draft: false
weight: 1
toc: true
seo:
  title: "" # custom title (optional)
  description: "" # custom description (recommended)
  canonical: "" # custom canonical URL (optional)
  robots: "" # custom robot tags (optional)
---

Springboard is a modular cross-platform application builder and runtime library that allows you to build applications that can run in a web browser, a desktop app, or a mobile app, and have type-safe communication between different contexts. The framework was built out of the necessity of creating MIDI applications deployed in a fullstack web application context, and simultaneously allowing the application to run standalone in the browser for maximum portability.

This dual requirement has shaped how the framework works, by maximizing the amount of code reuse across the different platforms, and utilizing JavaScript isomorphism as much as possible.

Springboard uses the concept of [modules](/docs/springboard/module-development) to encapsulate responsibilities of different pieces of code. A new Springboard application contains no modules by default. There are some predefined modules that you can import into your code, namely the modules defined by the [`@jamtools/core`](https://github.com/jamtools/springboard/tree/main/packages/jamtools/core/modules) package at the time of writing.

Each application build for a given platform consists of two parts:

- A platform entrypoint, also called a platform adapter
- An application entrypoint for the given platform

Combining these together results in a bundle to run for the given platform and application. You can use the same application entrypoint for multiple platforms (and by default the most turnkey usage of the [CLI](../cli/sb) assumes this), and use [conditional compilation](../conditional-compilation) to pivot platform dependencies/behavior as needed. Or you can specify different application entrypoints that mostly share the same code, but need some platform-specific code for feature initializations.

<!-- What is a full-stack multi-player MIDI application? An application where there is a client-server architecture involved, and one of the following:
- there are MIDI instruments plugged into the desktop/server computer, and mobile/browser clients can interact via a user interface.
- there are MIDI instruments connected to clients, and interacting with other clients that potentially also have MIDI instruments connected to them.

---

More information:

- [Developing a module](./module-development.md)
- [Deployment contexts](./deployment-contexts/deployment-contexts.md) - Single-player and multi-player -->
