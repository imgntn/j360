exports.ModuleKind = { CommonJS: 1 };
exports.transpileModule = (src) => {
  src = src.replace(/^import[^\n]*\n/gm, '');
  src = src.replace(/^export type[^\n]*\n/gm, '');
  src = src.replace(/\b(private|public|protected)\s+/g, '');
  src = src.replace(/\?\s*:\s*[^,\)]+/g, '');
  src = src.replace(/: [A-Za-z0-9_<>\[\]\|'" ]+(?=[=,);])/g, '');
  src = src.replace(/\)\s*:\s*[^\{]+\{/g, ') {');
  src = src.replace(/ implements [^\{]+/g, '');
  src = src.replace(/export class/, 'class');
  src = src.replace(/!\./g, '.');
  return { outputText: src };
};
