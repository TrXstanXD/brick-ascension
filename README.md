# Brick Ascension, an Idle Breakout clone

A self-contained HTML/CSS/JS idle game. No build step, no dependencies. (might change)

## v1.1 changes

- Fixed toast notifications never actually becoming visible (affected every notification, not just the Ascend button).
- Ascending now tells you why it's unavailable instead of silently doing nothing.
- Settings tab is now fully wired up: volume sliders, particle/screen-shake/damage-number toggles, and the autosave interval all load, save, and take effect (Screen Shake previously had no effect at all — it now actually shakes the canvas on crits, boss kills, and explosive detonations).
- The powerups bar below the game canvas (Meteor Strike, Gold Rain, Ball Frenzy, Brick Nuke) is rendered again, with lock/cooldown state, and refreshes live.
- Added offline progress: earnings now accrue while the tab is closed (based on your recent gold/sec, capped by your Chrono Cache prestige upgrade), with a "Welcome Back" summary on return.
- Added three new endgame ball types: **Homing Ball** (curves toward the weakest brick), **Chain Ball** (arcs between up to 4 nearby bricks), and **Void Ball** (ignores shields, rips bonus true damage as a % of a brick's max HP).

## Playing it

Just open `index.html` in a browser; but see the important note below about saving. (or just go to the github page at https://trxstanxd.github.io/brick-ascension/)

## ⚠️ Important: saving and `file://` URLs

This game saves your progress with `localStorage`, which is the standard way browser
games persist data. `localStorage` works perfectly once this is hosted on the web
(GitHub Pages, itch.io, any `https://` host) — nothing to do there, it just works.

The catch is **local testing**: if you open `index.html` by double-clicking it (a
`file://` URL), some browsers — Firefox in particular, and some Chrome configurations —
either block `localStorage` entirely or treat every page load as a brand-new,
unrelated origin. In that situation your save will NOT survive a refresh, no matter
how the save code is written; the browser itself is preventing persistence.

The game detects this and shows a warning banner at the top when it happens, with a
"Download Save File" / "Load Save File" fallback so you don't lose progress in the
meantime.

**To test locally with normal, persistent saving**, run a tiny local server instead of
double-clicking the file (any of these work):

```bash
# Python (usually pre-installed)
python3 -m http.server 8000
# then open http://localhost:8000

# Node
npx serve .

# VS Code
# install the "Live Server" extension, right-click index.html -> "Open with Live Server"
```

## Deploying to GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → set the source to your default branch (root).
3. Visit the generated `https://<username>.github.io/<repo>/` URL.

Once served over `https://`, `localStorage` behaves normally and saves persist across
refreshes and browser restarts, exactly as expected — the warning banner won't appear.

## Project structure

```
index.html
style/main.css        - all styling
scripts/util.js        - number formatting & math helpers
scripts/data.js        - ball types, brick types, upgrades, achievements (edit here to add content)
scripts/state.js       - game state, economy, prestige, achievements, save/load
scripts/engine.js      - canvas physics, brick/ball logic, particles, audio, skills
scripts/ui.js          - DOM rendering, tabs, panels, notifications
scripts/main.js        - bootstraps everything on page load
```

To add new ball types, brick types, upgrades, or achievements, everything lives in
`scripts/data.js` — the engine and UI read from those definitions generically.
