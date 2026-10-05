import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Architecture boundaries (game-architecture.md → Architectural Boundaries; AR16).
//
// Flat config replaces a rule's settings when a later block sets the same rule for a file, so the
// boundary rules are assembled per *disjoint* file group below: every src file matches exactly one
// group, and each group gets the full set of restrictions that applies to it.

const STORAGE_MSG = 'Only src/save/ touches storage.';
const PURE_MSG = 'sim/core/config are pure TypeScript: no Phaser, DOM, view, save, input or debug.';
const SECRET_MSG = 'View code must use PublicSheep; isAbomination is sim/debug only.';
const LOG_MSG =
  'Only core/log.ts may declare `log`: production treeshaking drops `log.info`/`log.debug` calls by name.';
const TIME_MSG = 'Use state.time (game-ms), not wall-clock time.';

// --- no-restricted-globals -------------------------------------------------------------------

const STORAGE_GLOBALS = ['localStorage', 'sessionStorage'].map((name) => ({ name, message: STORAGE_MSG }));

const PURE_GLOBALS = [
  'window',
  'document',
  'self',
  'globalThis',
  'navigator',
  'performance',
  'crypto',
  'fetch',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
].map((name) => ({ name, message: PURE_MSG }));

// --- no-restricted-properties ----------------------------------------------------------------

const STORAGE_PROPERTIES = ['globalThis', 'window', 'self'].flatMap((object) =>
  ['localStorage', 'sessionStorage'].map((property) => ({ object, property, message: STORAGE_MSG })),
);

const PURE_PROPERTIES = [
  { object: 'Math', property: 'random', message: 'Use the seeded rng(state) in the sim.' },
  { object: 'Date', property: 'now', message: TIME_MSG },
];

// --- no-restricted-syntax --------------------------------------------------------------------

const SECRECY_SYNTAX = [
  { selector: "MemberExpression[property.name='isAbomination']", message: SECRET_MSG },
  { selector: "MemberExpression[property.value='isAbomination']", message: SECRET_MSG },
  { selector: "Property[key.name='isAbomination']", message: SECRET_MSG },
];

const LOG_GUARD_SYNTAX = [
  { selector: "VariableDeclarator[id.name='log']", message: LOG_MSG },
  { selector: "FunctionDeclaration[id.name='log']", message: LOG_MSG },
  { selector: "ClassDeclaration[id.name='log']", message: LOG_MSG },
  { selector: ":function > Identifier.params[name='log']", message: LOG_MSG },
  { selector: "CatchClause > Identifier.param[name='log']", message: LOG_MSG },
  { selector: "ImportDeclaration:not([source.value=/(core\\/log|^\\.\\/log)$/]) > [local.name='log']", message: LOG_MSG },
  { selector: "ImportDeclaration[source.value=/(core\\/log|^\\.\\/log)$/] > ImportSpecifier[imported.name!='log'][local.name='log']", message: LOG_MSG },
];

const PURE_SYNTAX = [
  { selector: "NewExpression[callee.name='Date']", message: TIME_MSG },
  { selector: "CallExpression[callee.name='Date']", message: TIME_MSG },
  {
    selector: "ImportExpression[source.value=/^phaser|(^|\\/)(view|save|input|debug)(\\/|$)/]",
    message: PURE_MSG,
  },
];

// --- no-restricted-imports (pure layers only) ------------------------------------------------

const PURE_IMPORTS = [
  'error',
  {
    paths: [{ name: 'phaser', message: PURE_MSG }],
    patterns: [
      {
        group: [
          'phaser/*',
          '**/view',
          '**/view/**',
          '**/save',
          '**/save/**',
          '**/input',
          '**/input/**',
          '**/debug',
          '**/debug/**',
        ],
        message: PURE_MSG,
      },
    ],
  },
];

function group(files, { pure = false, storage = true, secrecy = true, logGuard = true }, ignores = []) {
  const globals = [...(storage ? STORAGE_GLOBALS : []), ...(pure ? PURE_GLOBALS : [])];
  const properties = [...(storage && !pure ? STORAGE_PROPERTIES : []), ...(pure ? PURE_PROPERTIES : [])];
  const syntax = [
    ...(secrecy ? SECRECY_SYNTAX : []),
    ...(logGuard ? LOG_GUARD_SYNTAX : []),
    ...(pure ? PURE_SYNTAX : []),
  ];
  const rules = {};
  if (globals.length) rules['no-restricted-globals'] = ['error', ...globals];
  if (properties.length) rules['no-restricted-properties'] = ['error', ...properties];
  if (syntax.length) rules['no-restricted-syntax'] = ['error', ...syntax];
  if (pure) rules['no-restricted-imports'] = PURE_IMPORTS;
  return { files, ignores, rules };
}

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'public/', 'coverage/', '_bmad/', '_bmad-output/', '.claude/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Same convention as tsc's noUnusedParameters: a leading underscore marks an intentionally unused parameter.
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },

  // Disjoint boundary groups (see header).
  group(['src/sim/**/*.ts'], { pure: true, secrecy: false }),
  group(['src/core/**/*.ts'], { pure: true }, ['src/core/log.ts']),
  group(['src/core/log.ts'], { pure: true, logGuard: false }),
  group(['src/config/**/*.ts'], { pure: true }),
  group(['src/debug/**/*.ts'], { secrecy: false }),
  group(['src/save/**/*.ts'], { storage: false }),
  group(['src/**/*.ts'], {}, ['src/sim/**', 'src/core/**', 'src/config/**', 'src/debug/**', 'src/save/**']),
);
