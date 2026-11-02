# নিশীথ নদী — The Midnight River

An immersive static Three.js experience by **Bad Time Studio**, created by **K.I.Rohan**.

## What's included

- Full-screen real-time 3D river environment
- Procedurally animated water shader with broken moonlight and lantern reflections
- Moon, drifting clouds, distant village houses, bamboo, trees, ghats, fireflies and floating leaves
- Traditional wooden fishing boat with rocking motion, fishing net, lantern, glow and subtle wake
- 120-second cinematic timeline with captions, a distant launch horn and closing credits
- Explore Mode with click/tap interactions, expanding water ripples, and a 10-entry persistent River Journal
- Sound Mixer for river water, night insects, wildlife and effects
- Public global page-visit counter (requires the free CounterAPI.com widget to be available)
- CC0 ambient audio beds and one-shot river/boat/launch effects streamed from SFXMint; no paid APIs required
- Cinematic / Explore modes, sound toggle, replay, fullscreen, interface visibility and credits
- Responsive layout and reduced-motion styling
- Supplied Bad Time Studio logo preserved as an asset

## Run locally

This is a static HTML/CSS/JavaScript project. It does not require React, Node.js, a build step, a database, or a backend.

Because browsers restrict JavaScript modules when opened directly with `file://`, serve the folder over localhost instead.

### Option A — Python (often already installed on Windows)

1. Extract the ZIP.
2. Open a terminal in the `nishith-nodi-site` folder.
3. Run:

   ```bash
   python -m http.server 8080
   ```

4. Open <http://localhost:8080> in Chrome or Edge.

If `python` is not recognized, try `py -m http.server 8080`.

### Option B — Node.js

If Node.js is installed, run:

```bash
npx serve .
```

Open the local URL printed by the command.

## Publish with GitHub Pages

1. Create a new GitHub repository.
2. Upload the contents of this folder (make sure `index.html` is at the repository root).
3. In the repository, open **Settings → Pages**.
4. Under the build/deployment source, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. Wait for GitHub Pages to publish the URL.

## Publish with Vercel

1. Push the project folder to a GitHub repository.
2. Import that repository into Vercel.
3. Select **Other** as the framework preset if asked.
4. No build command is needed. Use `.` as the output directory if Vercel requests one.
5. Deploy. Vercel will provide a `vercel.app` URL.

Vercel's free Hobby plan is intended for personal, non-commercial use. Review the current terms before using it for commercial studio work.

## Sound and visitor counter

The soundscape uses CC0 1.0 assets from SFXMint, including a prepared river ambience loop, night insects, distant wetland birds, a ship horn, a small-boat creak and a water plop. The direct audio URLs are streamed from SFXMint, so visitors need an internet connection for these tracks. The mixer sliders adjust each layer, and playback begins only after the visitor presses **ENTER THE RIVER**. If a sound URL is unavailable, the visual experience still works; the Sound Mixer reports loading problems.

A visible visit counter is embedded through CounterAPI.com using the public namespace `nishith-nodi-bad-time-studio`. This counts page visits, not verified unique human visitors, and depends on the third-party service. It does not require a private API key. If the widget service changes, the site itself continues to run.

## Dependencies and internet access

Three.js is imported from jsDelivr in `app.js`, and the optional typefaces are loaded from Google Fonts in `styles.css`. As written, the first visit requires internet access. For an offline/self-contained build, download and bundle the Three.js module and fonts locally, then update the import and font declarations.

## Notes

- Sound starts only after the visitor presses **ENTER THE RIVER**, respecting browser autoplay restrictions.
- The 3D scene is procedural. The visitor counter and CC0 audio use third-party hosted services; no private backend or paid API is required.
- Performance depends on device GPU, browser, resolution, and power settings. The renderer caps device pixel ratio for a more stable experience.
- This is a production-oriented first implementation; validate performance and visual details on your target desktop and mobile devices before a public launch.

## Credits

- CC0 sound effects: [SFXMint](https://sfxmint.com/) (river ambience, night ambience, ship horn, ship creak, water plop)
- Visit counter: [CounterAPI.com](https://counterapi.com/)

- **Bad Time Studio:** https://facebook.com/badTimeStudio/
- **K.I.Rohan:** https://www.linkedin.com/in/kirohan/
