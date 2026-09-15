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
      comment: 'Кольцо связей: модули держат друг друга, и ни один нельзя прочитать первым.',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-orphans',
      comment: 'Никто не зовёт и модуль никого не зовёт: либо забытый файл, либо потерянная связь.',
      severity: 'error',
      from: { orphan: true, pathNot: ['\\.css$'] },
      to: {}
    },
    {
      name: 'src-no-devdep',
      comment: 'Продукт не может зависеть от инструмента разработки: потребитель его не ставит.',
      severity: 'error',
      from: { path: '^src' },
      to: { dependencyTypes: ['npm-dev'] }
    },
    {
      name: 'src-no-tools',
      comment: 'Слой считается один раз: прода нет смысла в обвязке проверок.',
      severity: 'error',
      from: { path: '^src' },
      to: { path: '^tools' }
    },
    {
      name: 'src-no-test',
      comment: 'Продукт, тянущий тест, — признак того, что проверка переехала в код.',
      severity: 'error',
      from: { path: '^src' },
      to: { path: '^test' }
    },
    {
      name: 'test-no-bin',
      comment: 'Проверки зовут точку входа процессом, а не импортом: иначе проверяется не та поверхность.',
      severity: 'error',
      from: { path: '^test' },
      to: { path: '^bin' }
    },
    {
      name: 'not-to-unresolvable',
      comment: 'Импорт, который никто не может разрешить, — это сломанная связь, а не мелочь.',
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
