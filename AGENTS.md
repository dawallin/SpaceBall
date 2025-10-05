# Repository-Wide Agent Guidelines

## General Expectations
- This project hosts a mobile-first web game called **Space Ball**.
- All source code should live under the `src/` directory and use modern JavaScript (ES2020+) with modules. TypeScript is welcome but optional; if introduced, ensure build tooling is committed.
- Do not add backend services; the experience must be static and deployable to GitHub Pages.
- Prefer lightweight dependencies. If a 3D/physics engine is required, use Babylon.js unless there is a well-justified alternative documented in the PR description.

## Documentation & Specs
- Keep user-facing docs and design notes inside `docs/`.
- Behaviour must be captured using BDD-style `.feature` files in `docs/specs/`.
- When implementing or updating features, update the relevant specs first.

## Testing & Tooling
- Aim for deterministic behaviour suitable for automated validation.
- Automated acceptance checks should map directly to scenarios defined in the `.feature` files.

## Styling & Assets
- Optimise for mobile (portrait) layout by default. Desktop adaptations are optional.
- Use vector or programmatic assets when possible to minimise bundle size.

## Git & PR Process
- Keep commits scoped and descriptive.
- Each PR must reference which scenarios are implemented or updated.
