// Updates only marked generated regions; the rest of the userscript remains handwritten.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const definitions = [
  { id: "hand-cards-client", file: "src/adapters/hand-cards-client.js", name: "createHandCardsClient" },
  { id: "hand-cards", file: "src/features/hand-cards.js", name: "createHandCardsModule" },
];
function assemble(source) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  let output = source.replace(/\r\n/g, "\n");
  for (const definition of definitions) {
    const begin = "  // BEGIN GENERATED MODULE: " + definition.id;
    const end = "  // END GENERATED MODULE: " + definition.id;
    const start = output.indexOf(begin + "\n"), finish = output.indexOf(end + "\n");
    assert(start >= 0 && finish > start && output.indexOf(begin + "\n", start + 1) < 0 && output.indexOf(end + "\n", finish + 1) < 0,
      "Missing or duplicate module boundaries: " + definition.id);
    const factory = require(path.join(root, definition.file));
    assert.equal(typeof factory, "function");
    const text = begin + "\n  // Source: " + definition.file + "; run npm run build:userscript. Do not edit this block.\n" +
      "  const " + definition.name + " = " + factory.toString().replace(/\r\n/g, "\n").replace(/\n(?=.)/g, "\n  ") + ";\n" + end;
    output = output.slice(0, start) + text + output.slice(finish + end.length);
  }
  return newline === "\r\n" ? output.replace(/\n/g, "\r\n") : output;
}
if (require.main === module) {
  const target = path.join(root, "resources/daxiaochao.user.js");
  const source = fs.readFileSync(target, "utf8"), output = assemble(source);
  if (process.argv.includes("--check")) {
    if (output !== source) { process.stderr.write("Generated userscript modules are stale; run npm run build:userscript.\n"); process.exitCode = 1; }
    else process.stdout.write("Generated userscript modules are current.\n");
  } else {
    if (output !== source) fs.writeFileSync(target, output, "utf8");
    process.stdout.write(output === source ? "Userscript modules unchanged.\n" : "Userscript module regions updated.\n");
  }
}
module.exports = { assemble, definitions };
