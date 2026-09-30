/* Optional offline check: generate fixtures with F2_PREVIEW=1 and pass a local
   Playwright module path. No app dependency or authenticated service is needed. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2]);

function contrast(foreground, background) {
  const luminance = color => {
    const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

(async () => {
  const folder = path.join(os.tmpdir(), 'f2-ui-preview');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    let count = 0;
    for (const file of fs.readdirSync(folder).filter(f => f.endsWith('.html'))) {
      for (const width of [320, 360, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(pathToFileURL(path.join(folder, file)).href);
        const measurement = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
        assert.ok(measurement.content <= measurement.viewport, `${file} at ${width}: overflow ${measurement.content}`);
        for (const button of await page.locator('button:visible').all()) {
          const box = await button.boundingBox();
          assert.ok(box.height >= 44, `${file}: button height ${box.height}`);
        }
        await page.keyboard.press('Tab');
        assert.ok(await page.evaluate(() => document.activeElement !== document.body), `${file}: keyboard focus`);
        if (width === 320 || width === 1280) await page.screenshot({ path: path.join(folder, `${file}-${width}.png`), fullPage: true });
        if (file.startsWith('dashboard')) {
          const shell = page.locator('.dashboard-shell');
          const main = page.locator('.workspace-page');
          const spacing = await main.evaluate(el => ({ top: getComputedStyle(el).paddingTop, bottom: getComputedStyle(el).paddingBottom, left: getComputedStyle(el).paddingLeft }));
          assert.deepEqual(spacing, { top: width < 640 ? '24px' : '32px', bottom: width < 640 ? '24px' : '32px', left: width < 640 ? '16px' : '32px' }, `${file}: responsive page padding at ${width}`);
          await shell.evaluate(el => { el.style.setProperty('--container-page', '40rem'); });
          assert.equal(await main.evaluate(el => getComputedStyle(el).maxWidth), '640px', `${file}: container token`);
          assert.ok(await main.evaluate(el => el.getBoundingClientRect().width <= 640), `${file}: actual container width`);
          await shell.evaluate(el => { el.style.removeProperty('--container-page'); el.dataset.compact = 'true'; });
          assert.equal(await main.evaluate(el => getComputedStyle(el).paddingTop), '20px', `${file}: compact padding`);
          await shell.evaluate(el => { delete el.dataset.compact; });
          for (const theme of ['light', 'dark', 'system']) {
            await page.emulateMedia({ colorScheme: 'dark' });
            await shell.evaluate((el, value) => { el.dataset.theme = value; }, theme);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${file}: ${theme} overflow`);
            if (file === 'dashboard-users.html') {
              const label = page.getByText('Akun Anda', { exact: true });
              assert.equal(await label.count(), 1, 'self-account fixture must be present');
              const colors = await label.evaluate(el => ({ foreground: getComputedStyle(el).color, background: getComputedStyle(el.closest('.users-list')).backgroundColor, weight: getComputedStyle(el).fontWeight }));
              const ratio = contrast(colors.foreground, colors.background);
              assert.ok(ratio >= 4.5, `Akun Anda ${theme}: contrast ${ratio.toFixed(2)}`);
              assert.ok(Number(colors.weight) >= 600, 'self-account emphasis preserved');
              if (width === 320) console.log(`Akun Anda ${theme}: ${ratio.toFixed(2)}:1`);
            }
            if (width === 320 && theme === 'dark') await page.screenshot({ path: path.join(folder, `${file}-${width}-dark.png`), fullPage: true });
          }
          await page.emulateMedia({ colorScheme: 'light' });
        }
        count++;
      }
    }
    console.log(`${count} offline page/viewport checks passed. Screenshots: ${folder}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
