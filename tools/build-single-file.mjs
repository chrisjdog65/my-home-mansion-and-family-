// ───────────────────────────────────────────────────────────────────────────
// Bundles the whole game into one self-contained HTML file that runs straight
// off the disk — no server, no network, nothing to install.
//
//   npm i --no-save esbuild@0.28.2
//   node tools/build-single-file.mjs [--embed]
//
// The version is pinned so the same sources always produce the same bytes and
// a regenerated play.html shows up in review as a real change, not as noise.
// ───────────────────────────────────────────────────────────────────────────
import { build } from 'esbuild';
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'play.html');

// three.js is referenced by the bare specifier "three" and the "three/addons/"
// prefix, exactly as the import map in index.html declares them.
const importMapAlias = {
  name: 'three-alias',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({
      path: join(root, 'vendor/three/build/three.module.js'),
    }));
    b.onResolve({ filter: /^three\/addons\// }, (args) => ({
      path: join(root, 'vendor/three/examples/jsm', args.path.replace('three/addons/', '')),
    }));
  },
};

const license = readFileSync(join(root, 'vendor/three/LICENSE'), 'utf8').trim();

const result = await build({
  entryPoints: [join(root, 'src/main.js')],
  absWorkingDir: root,          // keeps the output identical whatever the cwd
  bundle: true,
  format: 'esm',
  target: ['es2020'],
  write: false,
  legalComments: 'none',
  plugins: [importMapAlias],
  banner: {
    js: [
      '/* HOME — Mansion & Family. Bundled from src/ by tools/build-single-file.mjs.',
      ' * Includes three.js r169:',
      ...license.split('\n').map((l) => ` * ${l}`.trimEnd()),
      ' */',
    ].join('\n'),
  },
});

// `</script` and `</style` inside the payload would close the host tag and
// dump the rest of the bundle onto the page as text. Both forms below are
// equivalent inside JS string and regex literals, and inside CSS.
const escapeTags = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');
const js = escapeTags(result.outputFiles[0].text);
const css = readFileSync(join(root, 'styles/ui.css'), 'utf8').replace(/<\/(style|script)/gi, '<\\/$1');
const html = readFileSync(join(root, 'index.html'), 'utf8');

// Strip the pieces that only make sense when the game is served: the import
// map, the stylesheet link and the module entry point.
const body = html
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace(/<link rel="stylesheet"[^>]*>\s*/, '')
  .replace(/<script type="module" src="[^"]*"><\/script>\s*/, '')
  .replace('</title>', '</title>\n<meta name="description" content="A first person game set in a mountain-view mega mansion with Kaelie, James and Chloie. Everything is generated in code — no downloads, no server." />')
  .replace('</head>', `<style>\n${css}\n</style>\n</head>`)
  .replace('<noscript>', `<script type="module">\n${js}\n</script>\n<noscript>`);

// ── guards: fail loudly rather than shipping a broken page ─────────────────
const must = [
  [!body.includes('importmap'), 'the import map survived — check index.html'],
  [!body.includes('src="./src/main.js"'), 'the module entry point survived'],
  [!body.includes('href="./styles/'), 'the stylesheet link survived'],
  [body.includes('name="description"'), 'the description meta was not injected — did the <title> change?'],
  [body.includes('<style>'), 'the stylesheet was not inlined'],
  [body.includes('WebGLRenderer'), 'the bundle does not contain three.js'],
  [body.includes('id="viewport"'), 'the canvas markup is missing'],
  [/<\/script>/.test(body.slice(body.indexOf('<script type="module">') + 22)), 'the script tag is unterminated'],
  [(body.match(/<script/g) || []).length === 1, 'expected exactly one script tag'],
];
for (const [ok, msg] of must) if (!ok) throw new Error(`build check failed: ${msg}`);

writeFileSync(OUT, body);
const kb = (statSync(OUT).size / 1024).toFixed(0);
console.log(`play.html written — ${kb} KB, ${body.split('\n').length} lines`);

// ── embeddable variant ─────────────────────────────────────────────────────
// Same page without the document skeleton, for hosts that supply their own
// <html>/<head>/<body> wrapper.
if (process.argv.includes('--embed')) {
  mkdirSync(join(root, 'build'), { recursive: true });
  const EMBED = join(root, 'build/play-embed.html');
  const head = body.slice(body.indexOf('<title>'), body.indexOf('</head>'));
  const inner = body.slice(body.indexOf('<body>') + 6, body.lastIndexOf('</body>'));
  const embed = `${head.replace(/<link rel="icon"[^>]*>/, '')}\n${inner}`;
  if (/<\/?(html|head|body)\b/i.test(embed)) throw new Error('embed variant still has document tags');
  writeFileSync(EMBED, embed);
  console.log(`build/play-embed.html written — ${(statSync(EMBED).size / 1024).toFixed(0)} KB`);
}
