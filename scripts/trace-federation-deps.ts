#!/usr/bin/env npx tsx
/**
 * Trace Federation Dependencies
 *
 * Analyzes imports from external/activities.next to determine
 * which npm packages are required. Outputs a manifest that can
 * be used to track and validate federation dependencies.
 *
 * Usage:
 *   npx tsx scripts/trace-federation-deps.ts [entry files...]
 *
 * Example:
 *   npx tsx scripts/trace-federation-deps.ts \
 *     external/activities.next/lib/services/signature.ts \
 *     external/activities.next/lib/activities/actions/create.ts
 *
 * Output:
 *   lib/federation/DEPENDENCIES.json
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

interface DepInfo {
  version: string | null;
  reason: string;
  imports: string[];
}

interface FederationDeps {
  $schema: string;
  description: string;
  source: string;
  generatedAt: string;
  entryPoints: string[];
  dependencies: Record<string, DepInfo>;
  existingInRoot: string[];
  newDepsNeeded: string[];
}

// Read upstream package.json for versions
const upstreamPkgPath = path.join(
  process.cwd(),
  'external/activities.next/package.json'
);
const upstreamPkg = JSON.parse(fs.readFileSync(upstreamPkgPath, 'utf-8'));
const upstreamDeps = {
  ...upstreamPkg.dependencies,
  ...upstreamPkg.devDependencies,
};

// Read root package.json to compare
const rootPkgPath = path.join(process.cwd(), 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
const rootDeps = {
  ...rootPkg.dependencies,
  ...rootPkg.devDependencies,
};

// Track discovered dependencies
const discoveredDeps = new Map<string, Set<string>>(); // dep -> files that import it
const visited = new Set<string>();

/**
 * Resolve a module specifier to a file path
 */
function resolveModule(
  fromFile: string,
  moduleSpecifier: string
): string | null {
  const dir = path.dirname(fromFile);

  // Handle relative imports
  if (moduleSpecifier.startsWith('.')) {
    const candidates = [
      path.join(dir, moduleSpecifier),
      path.join(dir, moduleSpecifier + '.ts'),
      path.join(dir, moduleSpecifier + '.tsx'),
      path.join(dir, moduleSpecifier + '/index.ts'),
      path.join(dir, moduleSpecifier + '/index.tsx'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Extract package name from import specifier
 */
function getPackageName(moduleSpecifier: string): string | null {
  // Skip relative imports
  if (moduleSpecifier.startsWith('.')) return null;

  // Skip path aliases (common patterns)
  // @/ is typically a path alias to project root
  if (moduleSpecifier.startsWith('@/')) return null;
  if (moduleSpecifier.startsWith('~/')) return null;
  if (moduleSpecifier.startsWith('#')) return null; // Node.js subpath imports

  // Skip Node.js built-ins
  const builtins = [
    'crypto',
    'fs',
    'path',
    'url',
    'http',
    'https',
    'stream',
    'util',
    'events',
    'buffer',
    'querystring',
    'os',
    'child_process',
    'assert',
    'zlib',
    'net',
    'tls',
    'dns',
    'worker_threads',
    'perf_hooks',
    'async_hooks',
    'v8',
    'vm',
    'readline',
    'repl',
    'inspector',
    'cluster',
    'dgram',
    'string_decoder',
    'timers',
    'tty',
    'punycode',
    'domain',
    'constants',
    'process',
    'sys',
    'module',
  ];
  const baseName = moduleSpecifier.split('/')[0];
  if (builtins.includes(baseName)) return null;
  if (moduleSpecifier.startsWith('node:')) return null;

  // Handle scoped packages (@org/pkg)
  if (moduleSpecifier.startsWith('@')) {
    const parts = moduleSpecifier.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    // Just @org without /pkg is invalid, skip
    return null;
  }

  // Regular package
  return moduleSpecifier.split('/')[0];
}

/**
 * Visit a file and extract its imports
 */
function visitFile(filePath: string) {
  const absolutePath = path.resolve(filePath);

  if (visited.has(absolutePath)) return;
  visited.add(absolutePath);

  if (!fs.existsSync(absolutePath)) {
    console.warn(`Warning: File not found: ${absolutePath}`);
    return;
  }

  const source = fs.readFileSync(absolutePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    absolutePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  function visit(node: ts.Node) {
    // Handle import declarations
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
      const pkgName = getPackageName(specifier);

      if (pkgName) {
        // External dependency
        if (!discoveredDeps.has(pkgName)) {
          discoveredDeps.set(pkgName, new Set());
        }
        discoveredDeps.get(pkgName)!.add(absolutePath);
      } else if (specifier.startsWith('.')) {
        // Relative import - recurse
        const resolved = resolveModule(absolutePath, specifier);
        if (resolved) {
          visitFile(resolved);
        }
      }
    }

    // Handle require() calls
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const specifier = node.arguments[0].text;
      const pkgName = getPackageName(specifier);

      if (pkgName) {
        if (!discoveredDeps.has(pkgName)) {
          discoveredDeps.set(pkgName, new Set());
        }
        discoveredDeps.get(pkgName)!.add(absolutePath);
      }
    }

    // Handle dynamic imports
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const specifier = node.arguments[0].text;
      const pkgName = getPackageName(specifier);

      if (pkgName) {
        if (!discoveredDeps.has(pkgName)) {
          discoveredDeps.set(pkgName, new Set());
        }
        discoveredDeps.get(pkgName)!.add(absolutePath);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(
    'Usage: npx tsx scripts/trace-federation-deps.ts [entry files...]'
  );
  console.log('');
  console.log('Example:');
  console.log(
    '  npx tsx scripts/trace-federation-deps.ts external/activities.next/lib/services/signature.ts'
  );
  process.exit(1);
}

console.log('Tracing imports from entry points...');
for (const entry of args) {
  console.log(`  → ${entry}`);
  visitFile(entry);
}

console.log(`\nFound ${discoveredDeps.size} external dependencies:\n`);

// Build output
const dependencies: Record<string, DepInfo> = {};
const existingInRoot: string[] = [];
const newDepsNeeded: string[] = [];

const sortedDeps = Array.from(discoveredDeps.keys()).sort();

for (const dep of sortedDeps) {
  const files = Array.from(discoveredDeps.get(dep)!).map((f) =>
    path.relative(process.cwd(), f)
  );
  const version = upstreamDeps[dep] || null;
  const inRoot = dep in rootDeps;

  dependencies[dep] = {
    version,
    reason: `Imported by ${files.length} file(s)`,
    imports: files,
  };

  if (inRoot) {
    existingInRoot.push(dep);
    console.log(`  ✓ ${dep} (already in root package.json)`);
  } else {
    newDepsNeeded.push(dep);
    console.log(
      `  ✗ ${dep}${version ? ` @ ${version}` : ''} (NEW - needs to be added)`
    );
  }
}

// Write output
const output: FederationDeps = {
  $schema: './dependencies.schema.json',
  description:
    'Dependencies required for ActivityPub federation from external/activities.next',
  source: 'external/activities.next',
  generatedAt: new Date().toISOString(),
  entryPoints: args,
  dependencies,
  existingInRoot,
  newDepsNeeded,
};

const outputPath = path.join(process.cwd(), 'lib/federation/DEPENDENCIES.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');

console.log(`\nOutput written to: ${outputPath}`);
console.log(`\nSummary:`);
console.log(`  Total dependencies: ${sortedDeps.length}`);
console.log(`  Already in root:    ${existingInRoot.length}`);
console.log(`  New deps needed:    ${newDepsNeeded.length}`);

if (newDepsNeeded.length > 0) {
  console.log(`\nTo add new dependencies:`);
  const addCmd = newDepsNeeded
    .map((dep) => {
      const version = upstreamDeps[dep];
      return version ? `${dep}@${version}` : dep;
    })
    .join(' ');
  console.log(`  yarn add ${addCmd}`);
}
