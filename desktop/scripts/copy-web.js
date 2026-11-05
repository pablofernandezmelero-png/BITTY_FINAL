// Copia ../www (la web de Bitty) a desktop/www para empaquetarla. desktop/www está en .gitignore: la fuente única es ../www.
const fs = require("fs"), path = require("path");
const src = path.join(__dirname, "..", "..", "www"), dst = path.join(__dirname, "..", "www");
if (!fs.existsSync(path.join(src, "index.html"))) { console.error("No encuentro ../www/index.html"); process.exit(1); }
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log("Web copiada a desktop/www");
