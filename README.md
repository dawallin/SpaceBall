# SpaceBall

SpaceBall is a mobile-first web game inspired by the classic mechanical toy where a metal ball rolls between two adjustable rails. The goal is to control the gap and tilt so the ball drops through the scoring zone at the right moment.

## Repository layout
- `AGENTS.md` — global guidelines for contributors and automation agents.
- `docs/` — planning material and behaviour specifications.
  - `docs/specs/` — BDD-style `.feature` files that define expected gameplay behaviour.
- `src/` — front-end implementation using modern JavaScript.
- `index.html` — published entry point that loads the assets from `src/` (compatible with GitHub Pages).

## Getting started
1. Review the `.feature` files under `docs/specs/` to understand the target behaviours.
2. Open `index.html` in a modern browser (or serve the repository statically) to play the latest build.
3. Keep the experience static so it can be deployed to GitHub Pages without a backend.

## Testing
1. Run `npm test` to execute the deterministic Node-based checks that cover rail geometry, tilt calculations, and the scoring pocket layout described in `docs/specs/touch_controls.feature`.
2. To enable the Playwright end-to-end suite, install dependencies with `npm install` (requires network access) and rerun `npm test`. When Playwright is available the command will also launch the browser-based scenarios; otherwise it prints a skip message so the unit checks can still run in constrained environments.
3. You can force the browser suite at any time with `npm run test:e2e` once Playwright is installed.

## Publishing to GitHub Pages
GitHub Pages can serve the site directly from the repository root. To publish:
1. Push the `main` branch to GitHub.
2. In the repository settings under **Pages**, choose the `main` branch and the `/root` folder.
3. Save. GitHub Pages will serve `index.html`, which references the CSS and JavaScript inside `src/` using relative paths that work from the published site.

After deployment, the game will be available at `https://<username>.github.io/<repository>/` without any additional build steps.
