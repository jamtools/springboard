---
title: "Quickstart"
description: "Build your first Jam Tools application"
summary: ""
date: 2023-09-07T16:13:18+02:00
lastmod: 2023-09-07T16:13:18+02:00
draft: false
weight: 10
toc: true
seo:
  title: "" # custom title (optional)
  description: "" # custom description (recommended)
  canonical: "" # custom canonical URL (optional)
  robots: "" # custom robot tags (optional)
---

1. Install [Node.js](https://nodejs.org/en/download/), and optionally [pnpm](https://pnpm.io/installation)

2. Use the npm package [`create-springboard-app`](https://www.npmjs.com/package/create-springboard-app) to create a new app. This will initialize a new Node.js project with the Springboard CLI installed.

```shell
npx create-springboard-app@latest --template jamtools
```

This will install the following packages:

- `react`
- `react-dom`
- `react-router` (Will be replaced with [TanStack Router](https://tanstack.com/router/latest))
- `springboard` - Used for RPC and state management
- `springboard-cli` - User for building and deploying your app
- `@jamtools/core` - MIDI and IO device related functionality

---

3. Run the app

```shell
npm run dev
```

---

4. Visit your app at [http://localhost:1337](http://localhost:1337)

---

5. Write your first module

The example file in `src/index.tsx` contains a simple midi thru module that pipes midi events from one user-chosen MIDI device to another

```tsx
import React from 'react';
import springboard from 'springboard';

import '@jamtools/core/modules/midi_macro';

springboard.registerModule('Main', {}, async (moduleAPI) => {
    const macroModule = moduleAPI.getModule('midi_macro');

    const {input, output} = await macroModule.createMacros(moduleAPI, {
        input: {
            type: 'musical_keyboard_input',
            config: {},
        },
        output: {
            type: 'musical_keyboard_output',
            config: {},
        },
    });

    input.subject.subscribe(evt => {
        output.send(evt.event);

        // or extend this note into a major triad

        // output.send({
        //     ...evt.event,
        //     number: evt.event.number + 4,
        // });

        // output.send({
        //     ...evt.event,
        //     number: evt.event.number + 7,
        // });
    });

    moduleAPI.registerRoute('', {}, () => {
        return (
            <div>
                <input.components.edit/>
                <output.components.edit/>
            </div>
        );
    });
});
```

6. If you'd like to involve your phone, you can visit your local server from your phone at `http://(HOSTNAME_OR_IP):1337`. Use the "Edit" buttons in the UI to configure the MIDI devices you want to use on your computer. That's right - you can use your phone to peer into the MIDI state of your computer and interact from the UI!

7. Test out the current functionality by playing notes on your MIDI keyboard. The notes should be sent to the MIDI output device you configured.

8. Mess around with changing the code in `src/index.tsx` to do other things. You can:
    - Try more purposeful [macro types](/docs/jamtools/midi/macros) that can have a more intentional experience for the user.
    - Change the styling of the Macro editors to your liking using CSS.
    - Add UI elements to interact with your DAW from your phone. A simple example of this here: [https://github.com/jamtools/daw-easy-button](https://github.com/jamtools/daw-easy-button)

9. If you'd like to discuss the UX around using macros, please comment on [this issue](https://github.com/jamtools/springboard/issues/24). To report an issue or request support for other macro types, [submit an issue](https://github.com/jamtools/springboard/issues/new).

Nice job! You've built your first Jam Tools app. Next you can learn about:
- [Deploying as a desktop app that hosts the UI for local devices](/docs/springboard/platforms/desktop-app)
- [Creating your own modules](/docs/springboard/module-development)
