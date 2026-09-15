/* Датчик связей: циклы, сироты, направление слоёв. Отдельно от тестов и линтера,
 * потому что класс дефекта свой — файл может быть чист по правилам и при этом
 * врастать в цикл или тянуть из прода то, что прода знать не должна.
 *
 * Замер текущего дерева: 80 модулей, 346 связей, находок ноль — значит храповик
 * чистый: любая находка новая по определению, и `--ignore-known` не нужен, пока
 * она одна. Появится находка, которую признали терпимой, — её кладут в
 * `.dependency-cruiser-known-violations.json` и это отдельное человеческое действие.
 *
 * Запуск: `pnpm run deps` (гейт, разбор в `tools/gates/deps.js`).
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
