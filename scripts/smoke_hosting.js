const assert = require('node:assert/strict');

const base = process.argv[2] || 'https://artic-official-home.web.app';
const pages = ['/', '/admin/', '/quarterly/', '/quarterly/acha/', '/projects/deus-ex-machina/', '/artic-le/'];
async function request(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
}
async function main() {
  for (const route of pages) {
    const response = await request(new URL(route, base));
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route);
    assert.equal(response.headers.get('x-frame-options'), 'DENY', route);
    assert.ok(response.headers.get('content-security-policy')?.includes("object-src 'none'"), route);
    assert.ok(response.headers.get('cache-control')?.includes('no-store'), route);
    const html = await response.text();
    assert.ok(html.includes('shared.js'), route);
    console.log(`PASS page ${route}`);
  }
  for (const route of ['/functions/index.js', '/functions/.env', '/.git/config', '/src/admin.html',
    '/scratch/last-customer-waitlist.html', '/serviceAccountKey.json', '/projects/deus-ex-machina/editor.html']) {
    const response = await request(new URL(route, base));
    assert.equal(response.status, 404, `Private path exposed: ${route}`);
  }
  const shared = await (await request(new URL('/js/shared.js', base))).text();
  const apiUrls = [...shared.matchAll(/(?:admin|quarterlyAdmin):\s*'(https:[^']+)'/g)].map(match => match[1]);
  assert.equal(apiUrls.length, 2, 'Existing admin endpoints must be retained');
  for (const url of apiUrls) {
    const response = await request(url);
    assert.equal(response.status, 401, 'Admin endpoint must reject unauthenticated requests');
  }
  const productsUrl = shared.match(/products:\s*'(https:[^']+)'/)?.[1];
  assert.ok(productsUrl);
  const products = await request(productsUrl);
  assert.equal(products.status, 200);
  assert.ok(Array.isArray(await products.json()));
  console.log('PASS private paths, existing API routing, unauthenticated admin rejection, read-only products');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
