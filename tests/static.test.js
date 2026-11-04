// Análisis estático de www/index.html con un parser real (acorn): detecta botones decorativos, traducciones
// incompletas, ejecución dinámica y código muerto sin tener que ejecutar la app.
const fs = require("fs"), path = require("path"), acorn = require("acorn"), walk = require("acorn-walk");
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "www", "index.html"), "utf8");
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("  FALLA: " + m); } };

const js = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
let ast; try { ast = acorn.parse(js, { ecmaVersion: "latest", locations: true }); } catch (e) { ok(false, "el JavaScript no se puede analizar: " + e.message); process.exit(1); }
ok(true, "");

// 1) ningún eval / new Function / document.write / setTimeout con cadena EN EL CÓDIGO (las cadenas de preguntas no cuentan)
const dyn = [];
walk.simple(ast, {
  CallExpression(c) {
    const f = c.callee;
    if (f.type === "Identifier" && f.name === "eval") dyn.push("eval línea " + c.loc.start.line);
    if (f.type === "MemberExpression" && f.object.name === "document" && f.property.name === "write") dyn.push("document.write línea " + c.loc.start.line);
    if (f.type === "Identifier" && /^(setTimeout|setInterval)$/.test(f.name) && c.arguments[0] && (c.arguments[0].type === "Literal" || c.arguments[0].type === "TemplateLiteral")) dyn.push(f.name + "(cadena) línea " + c.loc.start.line);
  },
  NewExpression(c) { if (c.callee.type === "Identifier" && c.callee.name === "Function") dyn.push("new Function línea " + c.loc.start.line); }
});
ok(dyn.length === 0, "ejecución dinámica en el código: " + dyn.join(", "));

// 2) todas las llamadas tt(es, en, nl) tienen exactamente 3 argumentos y ninguno vacío
let calls = 0; const bad = [];
walk.simple(ast, { CallExpression(c) {
  if (c.callee.type !== "Identifier" || c.callee.name !== "tt") return;
  calls++;
  if (c.arguments.length !== 3) bad.push("línea " + c.loc.start.line + ": " + c.arguments.length + " argumentos");
  else for (const a of c.arguments) if (a.type === "Literal" && a.value === "") bad.push("línea " + c.loc.start.line + ": idioma vacío");
} });
ok(calls > 200 && bad.length === 0, `traducciones tt(): ${calls} llamadas, problemas: ${bad.join("; ")}`);

// 3) declaraciones de nivel superior y manejadores on*
const decl = new Set(), refs = new Map();
for (const s of ast.body) {
  if (s.type === "FunctionDeclaration") decl.add(s.id.name);
  if (s.type === "VariableDeclaration") for (const d of s.declarations) if (d.id.type === "Identifier") decl.add(d.id.name);
}
walk.ancestor(ast, { Identifier(node, _s, anc) {
  const p = anc[anc.length - 2];
  if (p && ((p.type === "FunctionDeclaration" && p.id === node) || (p.type === "VariableDeclarator" && p.id === node))) return;
  refs.set(node.name, (refs.get(node.name) || 0) + 1);
} });
const inStr = new Map();
const countStr = s => { for (const m of s.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) inStr.set(m[1], 1); for (const m of s.matchAll(/\bon\w+="([^"]*)"/g)) for (const w of m[1].matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) inStr.set(w[1], 1); };
walk.simple(ast, { Literal(l) { if (typeof l.value === "string") countStr(l.value); }, TemplateElement(t) { countStr(t.value.cooked || ""); } });
countStr(html.replace(/<script[\s\S]*?<\/script>/g, ""));
const unused = [...decl].filter(k => !refs.get(k) && !inStr.get(k));
ok(unused.length === 0, "declaraciones de nivel superior sin ninguna referencia (código muerto): " + unused.join(", "));

const handlers = new Set();
for (const m of html.matchAll(/\bon(?:click|input|change|keydown|keyup|submit|focus|blur)="([^"]*)"/g)) for (const w of m[1].matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) handlers.add(w[1]);
const builtin = new Set(["if", "event", "alert", "confirm", "prompt", "$", "tt", "Number"]);
const missing = [...handlers].filter(h => !decl.has(h) && !builtin.has(h));
ok(handlers.size > 25 && missing.length === 0, `botones y campos: ${handlers.size} funciones llamadas desde la interfaz; sin definir (botón decorativo o roto): ${missing.join(", ")}`);

// 4) la política de seguridad de contenido sigue siendo restrictiva
const csp = (html.match(/Content-Security-Policy" content="([^"]*)"/) || [])[1] || "";
ok(/default-src 'none'/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'none'/.test(csp) && /form-action 'none'/.test(csp), "CSP restrictiva (default-src/object-src/base-uri/form-action 'none')");
ok(/connect-src https:\/\/\*\.supabase\.co(;|$)/.test(csp) && !/connect-src[^;]*\*[^.]/.test(csp.replace(/https:\/\/\*\.supabase\.co/, "")), "connect-src limitado a Supabase");
ok(!/script-src[^;]*(https?:|\*)/.test(csp), "script-src sin orígenes externos");

// 5) la clave del cliente es la pública, nunca una secreta
ok(/sb_publishable_[A-Za-z0-9_-]+/.test(html) && !/sb_secret_|service_role["'\s:=]+ey|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(html), "el cliente solo contiene la clave pública de Supabase (ni sb_secret_, ni service_role, ni un JWT)");

// 6) accesibilidad básica
ok(/<html lang="/.test(html) && !/user-scalable=no|maximum-scale=1\b/.test(html), "html con lang y sin bloquear el zoom");
ok(/focus-visible/.test(html) && /prefers-reduced-motion/.test(html), "estilos de foco visible y de movimiento reducido");
ok(/aria-live="polite"/.test(html) && /function a11y\(/.test(html), "avisos con aria-live y etiquetado de campos");

console.log(`static.test: ${n - fails}/${n} comprobaciones correctas`);
process.exit(fails ? 1 : 0);
