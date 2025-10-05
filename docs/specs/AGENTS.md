# Specs Directory Guidelines

- Store all behaviour-driven specifications as `.feature` files written in Gherkin.
- Each feature file should declare a single coherent aspect of the experience (e.g., core gameplay loop, controls, configuration UI).
- When adding a new capability, update or add the appropriate feature file before implementing code changes.
- Keep scenarios deterministic and focused on observable outcomes that can be verified via automated end-to-end tests.
- Include background sections when shared context improves readability.
