// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { toHtml } from '@/tools/markdown-preview/logic';
import { sanitize } from '@/tools/markdown-preview/sanitize';

function render(markdown: string): string {
  return sanitize(toHtml(markdown));
}

describe('sanitize', () => {
  it('removes a script tag written straight into the Markdown', () => {
    const html = render('<script>alert(1)</script>');

    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  it('removes an inline event handler', () => {
    expect(render('<img src=x onerror="alert(1)">')).not.toContain('onerror');
  });

  it('removes a javascript: link but keeps the text', () => {
    const html = render('[click me](javascript:alert(1))');

    expect(html).not.toContain('javascript:');
    expect(html).toContain('click me');
  });

  it('removes an iframe', () => {
    expect(render('<iframe src="https://example.com"></iframe>')).not.toContain(
      '<iframe',
    );
  });

  it('removes a style attribute and a style block', () => {
    expect(render('<p style="color:red">x</p>')).not.toContain('style');
    expect(render('<style>body{display:none}</style>')).not.toContain('<style');
  });

  it('removes a form, so nothing on the page can be submitted anywhere', () => {
    const html = render('<form action="/steal"><input name="password"></form>');

    expect(html).not.toContain('<form');
    expect(html).not.toContain('/steal');
  });

  it('keeps the checkbox a task list renders', () => {
    expect(render('- [x] done')).toContain('type="checkbox"');
  });

  it('keeps ordinary formatting', () => {
    const html = render('# Title\n\n**bold** and *italic* and `code`');

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
  });

  it('keeps a table', () => {
    expect(render('| a |\n| - |\n| 1 |')).toContain('<table>');
  });

  it('keeps an ordinary link and an image', () => {
    const html = render('[text](https://example.com) ![alt](https://example.com/a.png)');

    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('<img');
    expect(html).toContain('alt="alt"');
  });

  it('keeps the spans the highlighter adds', () => {
    const html = render('```js\nconst a = 1;\n```');

    expect(html).toContain('<span class=');
    expect(html).toContain('const');
  });

  it('keeps Thai text', () => {
    expect(render('สวัสดี **ครับ**')).toContain('สวัสดี');
  });

  it('survives a document that is nothing but an attack', () => {
    const nasty = [
      '<svg/onload=alert(1)>',
      '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
      '<math><mtext><script>alert(1)</script></mtext></math>',
      '<object data="x"></object>',
      '<embed src="x">',
    ].join('\n\n');

    const html = render(nasty);

    // onload survives as escaped text, which is inert; what matters is that no
    // element carries it as an attribute.
    expect(html).not.toMatch(/<[^>]+onload=/);
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<object');
    expect(html).not.toContain('<embed');
    expect(html).not.toContain('data:text/html');
  });
});
