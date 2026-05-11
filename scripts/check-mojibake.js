const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scanExts = new Set(['.html', '.css', '.js', '.json', '.md', '.txt']);
const skipDirs = new Set(['.git', '.claude', '.cursor', 'assets', 'tmp', 'node_modules']);

const suspicious = [
  { name: 'replacement character', re: /\uFFFD/ },
  { name: 'private-use character', re: /[\uE000-\uF8FF]/ },
  { name: 'question-mark mojibake marker', re: /(?:\?[\uF900-\uFAFF])|(?:[\uF900-\uFAFF]\?)/ },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) walk(path.join(dir, entry.name), out);
      continue;
    }
    const full = path.join(dir, entry.name);
    if (scanExts.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function lineColumn(line, re) {
  const match = re.exec(line);
  return match ? match.index + 1 : 1;
}

const findings = [];

for (const file of walk(root)) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of suspicious) {
      rule.re.lastIndex = 0;
      if (!rule.re.test(line)) continue;
      findings.push({
        file: path.relative(root, file),
        line: index + 1,
        col: lineColumn(line, rule.re),
        rule: rule.name,
        text: line.trim().slice(0, 160),
      });
      break;
    }
  });
}

if (findings.length > 0) {
  console.error(`Possible mojibake found: ${findings.length}`);
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line}:${finding.col} ${finding.rule}`);
    console.error(`  ${finding.text}`);
  }
  process.exit(1);
}

console.log('No mojibake markers found.');
