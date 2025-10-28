import { test, expect } from "@playwright/test";

async function waitForGameReady(page) {
  await page.goto("/");
  await page.waitForFunction(() => globalThis.__spaceBall?.ready === true);
  await page.waitForFunction(
    () => (globalThis.__spaceBall?.getPocketLayout()?.length || 0) === 6
  );
}

test.beforeEach(async ({ page }) => {
  await waitForGameReady(page);
});

test("simultaneous pad presses keep rails independent", async ({ page }) => {
  await page.evaluate(() => {
    const debug = globalThis.__spaceBall;
    debug.controls.pressPad("left", 1, 0.85);
    debug.controls.pressPad("right", 2, 0.15);
  });

  const offsets = await page.evaluate(() => {
    const debug = globalThis.__spaceBall;
    return {
      leftOffset: debug.state.leftOffset,
      rightOffset: debug.state.rightOffset,
      leftPointer: debug.state.leftPointer,
      rightPointer: debug.state.rightPointer,
    };
  });

  expect(offsets.leftPointer).toBe(1);
  expect(offsets.rightPointer).toBe(2);
  expect(offsets.leftOffset).toBeGreaterThan(0);
  expect(offsets.rightOffset).toBeLessThan(0);

  await page.evaluate(() => {
    const debug = globalThis.__spaceBall;
    debug.controls.releasePad("left", 1);
    debug.controls.releasePad("right", 2);
  });
});

test("touch pads expose visual feedback while active", async ({ page }) => {
  const leftPad = page.locator("#leftPad");
  await page.evaluate(() => {
    const debug = globalThis.__spaceBall;
    debug.controls.pressPad("left", 7, 0.5);
  });
  await expect(leftPad).toHaveClass(/is-active/);

  await page.evaluate(() => {
    const debug = globalThis.__spaceBall;
    debug.controls.releasePad("left", 7);
  });
  await expect(leftPad).not.toHaveClass(/is-active/);
});

test("touch zones block native browser gestures", async ({ page }) => {
  await expect(page.locator("#leftPad")).toHaveCSS("touch-action", "none");
  await expect(page.locator("#rightPad")).toHaveCSS("touch-action", "none");
});

test("scoring pockets stay centered under the rails", async ({ page }) => {
  const { pockets, geometry } = await page.evaluate(() => {
    const debug = globalThis.__spaceBall;
    return {
      pockets: debug.getPocketLayout(),
      geometry: debug.geometry,
    };
  });

  expect(pockets).toHaveLength(6);
  for (const pocket of pockets) {
    expect(pocket.x).toBeCloseTo(geometry.centerX, 3);
  }

  const pocketNames = pockets.map((pocket) => pocket.name);
  expect(pocketNames).toEqual([
    "Mercury",
    "Earth",
    "Mars",
    "Jupiter",
    "Saturn",
    "Pluto",
  ]);

  for (let i = 1; i < pockets.length; i += 1) {
    expect(pockets[i].y).toBeGreaterThan(pockets[i - 1].y);
  }
});
