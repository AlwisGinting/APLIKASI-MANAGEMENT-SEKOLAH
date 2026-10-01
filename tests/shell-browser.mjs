// Dependency-free offline layout runner for an existing headless browser.
// First build, then generate F2_PREVIEW fixtures. This only writes OS TEMP files.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
const folder = path.join(os.tmpdir(), 'f2-ui-preview');
const fixtures = fs.readdirSync(folder).filter(file => file.endsWith('.html') && file !== 'f3-runner.html');
if (!fixtures.length) throw new Error('Generate F2_PREVIEW fixtures first');
const urls = fixtures.map(file => ({ file, url: pathToFileURL(path.join(folder, file)).href }));
const script = `
const fixtures = ${JSON.stringify(urls)};
const results = [];
const failures = [];
function check(condition, message) { if (!condition) failures.push(message); }
async function run() {
  for (const { file, url } of fixtures) for (const width of [320,360,390,768,1280]) {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'display:block;border:0;height:900px;width:' + width + 'px';
    const loaded = new Promise((resolve,reject) => {
      frame.onload = resolve;
      setTimeout(() => reject(new Error('Fixture timeout')), 5000);
    });
    frame.src = url;
    document.body.append(frame);
    await loaded;
    const win = frame.contentWindow, doc = frame.contentDocument;
    const visible = el => el.getClientRects().length && win.getComputedStyle(el).visibility !== 'hidden';
    const prefix = file + ':' + width;
    check(win.innerWidth === width, prefix + ' viewport');
    const shell = doc.querySelector('.dashboard-shell');
    for (const theme of shell ? ['light','dark','system'] : ['light']) {
      if (shell) shell.dataset.theme = theme;
      check(doc.documentElement.scrollWidth <= width, prefix + ':' + theme + ' body overflow');
    }
    for (const button of doc.querySelectorAll('button')) if (visible(button)) {
      check(button.getBoundingClientRect().height >= 44, prefix + ' button touch height');
    }
    const first = [...doc.querySelectorAll('a,button,input,select,summary')].find(visible);
    if (first) { first.focus(); check(doc.activeElement === first, prefix + ' focusable'); }
    if (shell) {
      const summary = doc.querySelector('details summary');
      if (summary) {
        summary.parentElement.open = true;
        const panel = doc.querySelector('.shell-account-panel').getBoundingClientRect();
        check(panel.left >= 0 && panel.right <= width, prefix + ' account panel bounds');
        check(doc.querySelector('.shell-account-panel a[href="/dashboard/settings/security"]'), prefix + ' security link');
        summary.parentElement.open = false;
      }
      const header = doc.querySelector('.shell-header').getBoundingClientRect();
      const context = doc.querySelector('.shell-school-context').getBoundingClientRect();
      check(context.top >= header.bottom, prefix + ' header/context overlap');
      const dialog = doc.querySelector('dialog');
      if (width < 1024 && dialog) {
        dialog.showModal(); // Native layout only; not a React event test.
        const bounds = dialog.getBoundingClientRect();
        check(bounds.left >= 0 && bounds.right <= width, prefix + ' drawer bounds');
        check(doc.querySelector('dialog nav').textContent.includes('Keamanan'), prefix + ' drawer security');
        dialog.close();
      }
    }
    results.push({ file, width });
    frame.remove();
  }
  document.getElementById('f3-result').textContent = JSON.stringify({ checks: results.length, widths:[320,360,390,768,1280], failures });
}
run().catch(error => { document.getElementById('f3-result').textContent = JSON.stringify({ error: error.message }); });
`;
fs.writeFileSync(path.join(folder, 'f3-runner.html'), `<!doctype html><html lang="id"><meta charset="utf-8"><title>F3 offline layout checks</title><body><pre id="f3-result">RUNNING</pre><script>${script}</script></body></html>`);
console.log(path.join(folder, 'f3-runner.html'));
