/* The dependencies sensor: cycles, orphans, the direction of layers. Apart from the checks and the linter
 * because the defect class is its own — a file can be clean by the rules and still grow into a cycle or
 * pull into the product what the product must not know.
 *
 * The ratchet of this sensor lives in `tools/gates/deps.js` (`--ignore-known` and the known-violations
 * file): it stays unused while the tree is clean, and tolerating a finding is a person's decision rather
 * than a sensor's move.
 *
 * The `comment` of every rule below is printed with the finding: it is the sensor's verdict, in the same
 * language as the other verdicts, and not a remark for the reader of this file.
 *
 * Run: `pnpm run deps`.
 */

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'A cycle: the modules hold each other, and neither can be read first.',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-orphans',
      comment: 'Nobody calls it and it calls nobody: either a forgotten file or a lost link.',
      severity: 'error',
      from: { orphan: true, pathNot: ['\\.css$'] },
      to: {}
    },
    {
      name: 'src-no-devdep',
      comment: 'The product cannot depend on a development tool: the consumer does not install it.',
      severity: 'error',
      from: { path: '^src' },
      to: { dependencyTypes: ['npm-dev'] }
    },
    {
      name: 'src-no-tools',
      comment: 'A layer is counted once: the product has no business inside the checks harness.',
      severity: 'error',
      from: { path: '^src' },
      to: { path: '^tools' }
    },
    {
      name: 'src-no-test',
      comment: 'A product pulling in a test is a sign that a check has moved into the code.',
      severity: 'error',
      from: { path: '^src' },
      to: { path: '^test' }
    },
    {
      name: 'test-no-bin',
      comment: 'The checks call the entry point as a process rather than through an import: otherwise the wrong surface is checked.',
      severity: 'error',
      from: { path: '^test' },
      to: { path: '^bin' }
    },
    {
      name: 'not-to-unresolvable',
      comment: 'An import nobody can resolve is a broken link rather than a trifle.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: 'node_modules|fixtures|reports' },
    tsPreCompilationDeps: false,
    combinedDependencies: false
  }
};
