---
title: "Background on Jam Tools"
description: "Jam Tools application and framework background"
summary: ""
date: 2024-12-02T14:38:33+02:00
lastmod: 2024-12-02T14:38:33+02:00
draft: false
weight: 50
categories: []
tags: []
contributors: []
pinned: false
homepage: false
seo:
  title: "" # custom title (optional)
  description: "" # custom description (recommended)
  canonical: "" # custom canonical URL (optional)
  robots: "" # custom robot tags (optional)
---

I've been wanting to have a public journal for my current efforts of software development, so here it is.

Right now I'm focusing on 2 projects:

- [Jam Tools](https://jam.tools) - An ecosystem of software development tools to build cross-platform multiplayer MIDI applications
- [SongDrive](https://songdrive.app) - An online songwriting and collaboration platform

This post is about Jam Tools, more specifically about the application framework [Springboard](https://docs.jam.tools/springboard/overview) and [Jam Tools Core](https://docs.jam.tools/jamtools/overview) (additional code to make it easy to work with MIDI and IO devices). You can check out the [repo](https://github.com/jamtools/springboard) for more info. The project is open-source to enable developers to make their own MIDI applications, and also collaborate together on features to include into a common application.

Jam Tools was created with an interest in making a realtime music communication tool that allows musicians to communicate thoughts to each other while playing music (The Jam App). It's meant to be used with everyone in the same room, and ideas can be circulated among different phones and screens in the room. The goal is to communicate chord progressions, lyrics, and messages such as "slow down" or "let's play something funky". It also helps automate [MIDI](https://en.wikipedia.org/wiki/MIDI)-related processes and control [WLED](https://kno.wled.ge) lighting.

Here are some videos from *previous* implementations before starting on the current project. There were lots of learnings from writing this code that contributes to the design of Springboard now. I think the videos capture the spirit of what I'm trying to make.

<details>
<summary>Demo Videos</summary>

- Jam Tools live demo with MidiCrash - Control synth chords and lights with crash cymbal. [Code](https://github.com/jamtools/springboard-local/tree/main/shared/application_mode_managers/adhoc_chord_mode)

{{< youtube-custom id="mYMZ2E7LKQI" >}}

---

- MidiCrash - Use a real crash cymbal as a MIDI trigger. [Code](https://github.com/jamtools/midi-crash)

{{< youtube-custom id="DdHDOOWZTPY" >}}

---

- Jam Tools live demo - Control chords and lights with MIDI drum controller. [Code](https://github.com/jamtools/springboard-local/blob/main/shared/application_mode_managers/progression_mode/progression_mode_manager.ts)

{{< youtube-custom id="UII4HS0Vb9Q" >}}

</details>

---

Back to the project - One thing the Jam App requires is using a phone/tablet to remotely control something on a separate computer that has the MIDI devices plugged in (i.e. a phone communicating with a desktop app hosting a local server). From experience of trying to build this program a few times, in order for this to scale this means there needs to be high cohesion between the UI code running on the phone, and the feature-level code related to MIDI functionality running on the server. Another required feature is the application to optionally run standalone in the browser, so you can do everything on the phone in isolation. Given these constraints, the application needs to run in multiple different deployment contexts, such as:

- Browser local/offline
- Browser with server

At the time of writing, there is also active development to support the following:

- Desktop app local/offline
- Desktop app online with remote server
- Desktop app with local server
- Desktop app online with remote server, and local server
- Mobile app local/offline (iOS has not implemented Web MIDI yet... which is why this is necessary)
- Mobile app with remote or local server

Because of these requirements, the project has since turned into a framework for creating cross-platform applications, with an emphasis on isomorphic TypeScript code (through using JSON-RPC behind the scenes), which helps with the cohesion of UI and MIDI-related code. The framework should allow for compiling into all of these formats with "zero config", like the DX of [Parcel](https://parceljs.org), and require a minimal amount of feature-level Typescript code to implement the given application's features.

Each app compilation consists of a "platform entrypoint" (usually provided by the framework and used by the framework by default, for the given platform/spec being compiled), and an "application entrypoint", where multiple [modules](https://docs.jam.tools/springboard/module-development) will make up a given app's features. All platform deployments can share the same application entrypoint, which is what makes the code cohesive.

---

##### Desktop

For desktop app compilation, the framework uses [Tauri](https://v2.tauri.app). The local server portion is currently being implemented with a [Node.js sidecar](https://v2.tauri.app/learn/sidecar-nodejs), though we may go in the direction of utilizing Rust for the local server hosting and relaying RPC calls to the Tauri webview process, and potentially not require the sidecar at all. I like the security model of Tauri's ecosystem, and having the node sidecar kind of messes that up. I'm also considering using Deno since it similarly supports explicit security features and compiles to binary directly, so tools like pkg won't be necessary in that case. But it still adds another asset to be signed/reviewed/shipped, which is a liability. So I think going with rust for network functionality is the way to go. Having the sidecar also makes things more difficult to debug. I was originally thinking that doing MIDI stuff in its own process would have lots of performance benefits, but I think it would perform fine in the webview process, as long as the UI isn't doing fancy/expensive things during midi operations. In the case where we need to optimize performance there, we should be able to use a separate invisible Tauri webview for optimizing midi/audio performance.

##### Mobile

For mobile app compilation, the framework uses [React Native](https://reactnative.dev) and [Expo](https://expo.dev). The compiled mobile app's UI is shown via an embedded webview, which has access to React Native functions through the Springboard RPC system. This way we can utilize all of React Native's ecosystem, while creating a [Web Native App](https://ionic.io/resources/articles/what-is-web-native) with React as the underlying view layer in both contexts. Great flexibility with no code required in the application to wire things up.

##### Server

We're also planning to support [Cloudflare Workers](https://workers.cloudflare.com) and [PartyKit](https://www.partykit.io) for turnkey room-isolation. The infrastructure at CloudFlare is pretty affordable, scalable, developer-friendly, and is built on Web Standards. Using PartyKit, a running app is compartmentalized into a specific room, so things like game lobbies and sessions for a particular game implementation can be more straightforward to segment and scale in a given project. In this case, PartyKit is solving something that I think Springboard should also directly support as far as managing the data of that room, which is the idea of something I'm currently defining as "Spawnables" (or "Snacks"). It would likely "feel" like defining a module though it has its own managed instance state, and is meant to be arbitrarily allocated in server state, like the PartyKit room does for us when it creates a new room. Spawnables can also be used as a more low-level thing, like instantiating a VST plugin-like object in some midi/audio pipeline context, that has some UI and state associated with it when it's spawned by the user.

---

The plan is to have multiple zero-config managed workflows to create these applications without downloading the needed build tools to do so, by utilizing GitHub actions, and a `create-springboard-app` command that populates a new project with a bunch of GitHub action workflows, each referencing reusable maintained versions of the workflows. Then you can create desktop and mobile apps and deploy your app to a cloud provider by simply pushing tags to a new project, or any other appropriate workflow trigger.

The generic application framework described above is published on npm as [`springboard`](https://github.com/jamtools/springboard/tree/main/packages/springboard/core) and [`springboard-cli`](https://github.com/jamtools/springboard/tree/main/packages/springboard), whereas the code to make MIDI-related features is in [`@jamtools/core`](https://github.com/jamtools/springboard/tree/main/packages/jamtools/core). The main currently available MIDI features are in the [Macro](https://docs.jam.tools/jamtools/macro-module) module.

The project is open-source to enable developers to make their own MIDI applications, and also collaborate together on features to include into a common application. Feel free to join the Jam Tools [Discord server](https://jam.tools/discord) to join the conversation, or subscribe to the [newsletter](https://jamtools.kit.com/2b15625d04).

Thanks for reading!

Here's a relevant presentation on the framework:

{{< youtube-custom id="_DrV000Se7M" >}}
