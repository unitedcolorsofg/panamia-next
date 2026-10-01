/**
 * XSS regression tests for the post-body sanitiser.
 *
 * Post bodies are stored as HTML and rendered with `dangerouslySetInnerHTML`
 * at four sinks. Before this suite existed, nothing in the repo sanitised
 * them, so anyone who could post could run JavaScript in every viewer's
 * browser. These tests pin the two controls that close that:
 *
 *  - `sanitizeStatusHtml`, applied at render by `<SafeHtml>`, which is what
 *    protects rows already written and anything arriving over federation
 *  - the markdown hooks in lib/federation/markdown.ts, which stop hostile
 *    markup being written into new local posts in the first place
 *
 * No database or network: both units are pure functions.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeStatusHtml, isSafeUrl, escapeHtml } from '@/lib/sanitize-html';
import { renderStatusMarkdown } from '@/lib/federation/markdown';

describe('sanitizeStatusHtml — script execution', () => {
  test('drops a script tag and its contents', () => {
    const out = sanitizeStatusHtml('hi <script>alert(1)</script>');
    assert.doesNotMatch(out, /<script/i);
    // The body of the script must go too, not survive as visible text.
    assert.doesNotMatch(out, /alert/);
    assert.match(out, /hi/);
  });

  test('drops an img with an onerror handler', () => {
    const out = sanitizeStatusHtml('<img src=x onerror=alert(1)>');
    assert.doesNotMatch(out, /<img/i);
    assert.doesNotMatch(out, /onerror/i);
  });

  test('strips event handlers from tags that are otherwise allowed', () => {
    const out = sanitizeStatusHtml(
      '<p onclick="alert(1)" onmouseover="alert(2)">text</p>'
    );
    assert.doesNotMatch(out, /onclick/i);
    assert.doesNotMatch(out, /onmouseover/i);
    assert.match(out, /<p>text<\/p>/);
  });

  test('drops embedding tags used to load remote code', () => {
    for (const html of [
      '<iframe src="https://evil.test"></iframe>',
      '<object data="https://evil.test"></object>',
      '<embed src="https://evil.test">',
      '<style>body{display:none}</style>',
    ]) {
      const out = sanitizeStatusHtml(html);
      assert.doesNotMatch(out, /<(iframe|object|embed|style)/i, html);
      assert.doesNotMatch(out, /evil\.test/, html);
    }
  });

  test('drops svg-based handler payloads', () => {
    const out = sanitizeStatusHtml('<svg><animate onbegin=alert(1)></svg>');
    assert.doesNotMatch(out, /<svg/i);
    assert.doesNotMatch(out, /onbegin/i);
  });
});

describe('sanitizeStatusHtml — dangerous URLs', () => {
  test('removes a javascript: href but keeps the link text', () => {
    const out = sanitizeStatusHtml('<a href="javascript:alert(1)">click</a>');
    assert.doesNotMatch(out, /javascript:/i);
    assert.match(out, /click/);
  });

  test('removes a data: href', () => {
    const out = sanitizeStatusHtml(
      '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>'
    );
    assert.doesNotMatch(out, /data:/i);
  });

  test('removes javascript: obfuscated with control characters', () => {
    for (const href of [
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      ' javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
    ]) {
      const out = sanitizeStatusHtml(`<a href="${href}">x</a>`);
      assert.doesNotMatch(out, /script:/i, href);
    }
  });

  test('keeps ordinary http(s) links', () => {
    const out = sanitizeStatusHtml(
      '<a href="https://ok.test/a?b=1&amp;c=2">x</a>'
    );
    assert.match(out, /href="https:\/\/ok\.test/);
  });

  test('forces rel and target on links', () => {
    const out = sanitizeStatusHtml('<a href="https://ok.test">x</a>');
    assert.match(out, /rel="noopener noreferrer ugc"/);
    assert.match(out, /target="_blank"/);
  });
});

describe('sanitizeStatusHtml — ordinary markdown survives', () => {
  test('keeps bold, italics, links and lists', () => {
    const html =
      '<p><strong>bold</strong> and <em>italic</em> and ' +
      '<a href="https://ok.test">a link</a></p>' +
      '<ul><li>one</li><li>two</li></ul>';
    const out = sanitizeStatusHtml(html);

    assert.match(out, /<strong>bold<\/strong>/);
    assert.match(out, /<em>italic<\/em>/);
    assert.match(out, /<li>one<\/li>/);
    assert.match(out, /<li>two<\/li>/);
    assert.match(out, /a link/);
  });

  test('keeps headings, blockquote, code and preformatted blocks', () => {
    const html =
      '<h2>Title</h2><blockquote><p>quoted</p></blockquote>' +
      '<pre><code class="language-ts">const a = 1;</code></pre>';
    const out = sanitizeStatusHtml(html);

    assert.match(out, /<h2>Title<\/h2>/);
    assert.match(out, /<blockquote>/);
    assert.match(out, /class="language-ts"/);
    assert.match(out, /const a = 1;/);
  });

  test('keeps GFM tables, which marked emits with gfm enabled', () => {
    const out = sanitizeStatusHtml(
      '<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>c</td></tr></tbody></table>'
    );
    assert.match(out, /<table>/);
    assert.match(out, /<th>h<\/th>/);
    assert.match(out, /<td>c<\/td>/);
  });
});

describe('sanitizeStatusHtml — Mastodon markup', () => {
  test('keeps the invisible and mention class hooks', () => {
    const out = sanitizeStatusHtml(
      '<p><span class="invisible">https://</span>x.test ' +
        '<a class="mention" href="https://m.test/@a">@a</a></p>'
    );
    assert.match(out, /<span class="invisible">/);
    assert.match(out, /class="mention"/);
  });

  test('rejects class names outside the Mastodon set', () => {
    // Every Tailwind utility is live on these pages, so an arbitrary class on
    // attacker-controlled markup is a click-harvesting overlay primitive.
    const out = sanitizeStatusHtml(
      '<span class="fixed inset-0 z-50 bg-white">overlay</span>'
    );
    assert.doesNotMatch(out, /fixed/);
    assert.doesNotMatch(out, /inset-0/);
    assert.match(out, /overlay/);
  });
});

describe('sanitizeStatusHtml — input handling', () => {
  test('treats null and undefined as empty', () => {
    assert.equal(sanitizeStatusHtml(null), '');
    assert.equal(sanitizeStatusHtml(undefined), '');
    assert.equal(sanitizeStatusHtml(''), '');
  });

  test('is idempotent, so double-sanitising does not corrupt output', () => {
    const html = '<p><strong>b</strong> <a href="https://ok.test">l</a></p>';
    const once = sanitizeStatusHtml(html);
    assert.equal(sanitizeStatusHtml(once), once);
  });
});

describe('isSafeUrl', () => {
  test('accepts the allowed schemes and relative URLs', () => {
    for (const url of [
      'https://ok.test',
      'http://ok.test',
      'mailto:a@ok.test',
      '/relative',
      '#anchor',
      'relative/path',
    ]) {
      assert.equal(isSafeUrl(url), true, url);
    }
  });

  test('rejects executable and smuggling schemes', () => {
    for (const url of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'java\tscript:alert(1)',
      '\u0001javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ]) {
      assert.equal(isSafeUrl(url), false, url);
    }
  });
});

describe('escapeHtml', () => {
  test('neutralises the characters that start markup', () => {
    assert.equal(
      escapeHtml('<script>"x"&\'y\'</script>'),
      '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;'
    );
  });
});

describe('renderStatusMarkdown — ingest-side defence in depth', () => {
  test('escapes raw HTML instead of emitting it', async () => {
    const out = await renderStatusMarkdown(
      'hi <img src=x onerror=alert(1)>\n\n<script>alert(2)</script>'
    );
    assert.doesNotMatch(out, /<img/i);
    assert.doesNotMatch(out, /<script/i);
    // The author's literal text is preserved, just inert.
    assert.match(out, /&lt;script&gt;/);
  });

  // The custom link renderer overrides marked's built-in scheme check, so these
  // are exercised through the markdown path and not just isSafeUrl: a future
  // change to that renderer is exactly how this vector was introduced.
  for (const [name, markdown] of [
    ['javascript:', '[click](javascript:alert(1))'],
    ['mixed-case javascript:', '[click](JaVaScRiPt:alert(1))'],
    ['data:text/html', '[click](data:text/html,<script>alert(1)</script>)'],
  ] as const) {
    test(`drops a ${name} markdown link but keeps its text`, async () => {
      const out = await renderStatusMarkdown(markdown);
      assert.doesNotMatch(out, /javascript:/i);
      assert.doesNotMatch(out, /data:/i);
      assert.doesNotMatch(out, /<a /);
      assert.match(out, /click/);
    });
  }

  test('still renders ordinary markdown', async () => {
    const out = await renderStatusMarkdown(
      '**bold** and [link](https://ok.test)\n\n- one\n- two'
    );
    assert.match(out, /<strong>bold<\/strong>/);
    assert.match(out, /href="https:\/\/ok\.test"/);
    assert.match(out, /rel="noopener noreferrer ugc"/);
    assert.match(out, /<li>one<\/li>/);
  });

  test('output of the markdown pipeline survives the sanitiser intact', async () => {
    // The two controls have to agree: anything marked legitimately emits for
    // a post must still be there after the render-time allowlist runs.
    const rendered = await renderStatusMarkdown(
      '# Heading\n\n**bold** [link](https://ok.test)\n\n- one\n\n> quote\n\n`code`'
    );
    const sanitised = sanitizeStatusHtml(rendered);

    for (const fragment of [
      '<h1>Heading</h1>',
      '<strong>bold</strong>',
      '<li>one</li>',
      '<blockquote>',
      '<code>code</code>',
    ]) {
      assert.ok(
        sanitised.includes(fragment),
        `expected sanitised output to keep ${fragment}\ngot: ${sanitised}`
      );
    }
  });
});
