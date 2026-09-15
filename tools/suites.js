/* The split of the check set into the fast run and the full one.
 *
 * **Why the split goes like this.** What a check costs here is not the size of its file but how many times the file runs
 * the tool and git: every run is a Node process (tens of milliseconds) while a clone of the fixture and building the
 * artifact cost hundreds. Hence the fast run keeps the files that prove their point from what is read: sources, the git
 * tree, the help, the fixture's reference numbers. The full run keeps those that drive the tool many times over in clones
 * of their own, commit and install hooks; the reason for each stands in `SLOW`, line by line, so that "expensive" never
 * rests on a word.
 *
 * **The default is the full run.** A file becomes fast only here, explicitly and with a reason. So new expensive work
 * cannot slip into the fast run quietly: a file missing here goes to the full run, and the guard (`test/suites.test.js`)
 * demands a reason for it — that is, the declaration has to be made and will show up in a diff.
 *
 * **There are no time targets here, and that is a decision.** Seconds depend on the window — a machine's load is whatever
 * it is — so neither the run nor CI fails over time, and there is no snapshot of cost to agree with either: the duration
 * is printed by measurement (`tools/run-tests.js`) as a reference to what belongs in the full run, while the split rests
 * on what a file is about rather than on how long it takes.
 *
 * Every file's duration, one run at a time: `pnpm run suites:measure`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEST_DIR = path.join(ROOT, 'test');

/* The fast run: `pnpm test`. Every entry carries the reason it is here. */
export const FAST = [
  { file: 'test/api.test.js', why: 'публичный API заморожен списком: любая правка движка обязана его не тронуть' },
  { file: 'test/refusals-catalog.test.js', why: 'каталог отказов против исходников: читает файлы и считает места отказа, инструмент не запускает ни разу' },
  { file: 'test/runner.test.js', why: 'чтение вывода процесса: куски склеиваются буферами — чистая функция, без git и без запусков' },
  { file: 'test/docs-paths.test.js', why: 'пути документации против дерева и таблицы файлов: правится в каждом проходе, значит и проверяться должен в каждом' },
  { file: 'test/docs-commands.test.js', why: 'зовы, причины отказа и адреса разделов против справки: то же обещание документации' },
  { file: 'test/docs-numbers.test.js', why: 'числа проверок против факта: документ стареет молча, если его не читать каждый раз' },
  { file: 'test/docs-pin.test.js', why: 'пин установки против справки закреплённой ревизии: путь, по которому ставится пакет' },
  { file: 'test/git-pins.test.js', why: 'граница вызова git: читает исходники и историю, инструмент не запускает' },
  { file: 'test/templates.test.js', why: 'шаблоны для чужого проекта: черновик настроек и описание проверки целиком — на свежем маленьком репозитории' },
  { file: 'test/guard.test.js', why: 'разбор модуля: идёт в рабочем потоке, сотни разборов в одном процессе — запусков нет вовсе' },
  { file: 'test/changelog.test.js', why: 'сторож выпуска: версия против манифеста и числа против прогона на фикстуре (два запуска)' },
  { file: 'test/parity.test.js', why: 'паритет с эталоном: главное обещание переноса — числа байт в байт, а отчёт собирается и проходит свой контроль; прогоны кэшированы и идут на общей фикстуре' },
  { file: 'test/frozen.test.js', why: 'замороженная копия: та ли ревизия и воспроизводит ли она эталон — различитель «поехал эталон» и «сломался движок»' },
  { file: 'test/contract-data.test.js', why: 'контракт данных: числа против эталона и состав полей — считает в памяти, инструмент зовёт один раз' },
  { file: 'test/contract-derived.test.js', why: 'производные против чисел артефакта: итоги и дельты считает вычислительная часть из файла, инструмент зовёт один раз' },
  { file: 'test/page-view.test.js', why: 'собранная страница в настоящем DOM: вклейка программы, пустота, оформление, переключение — сборок две, обе на общей фикстуре' },
  { file: 'test/page-tree.test.js', why: 'дерево файлов панели в настоящем DOM: папки по путям проекта, поддерево, прокрутка при пересборке — сборка страницы одна, на общей фикстуре' },
  { file: 'test/page-choice.test.js', why: 'память выбора и ссылка в настоящем DOM: перезаходы и смены адреса — считает в памяти, сборка страницы одна' },
  { file: 'test/suites.test.js', why: 'сторож самого разделения: читает объявление и исходники, ничего не запускает' },
  { file: 'test/gates-verify.test.js', why: 'сторож профиля проверок: читает `run.js`, рабочие процессы и хуки — запусков инструмента нет, только три зова за списком шагов' }
];

/* The full run: `pnpm test:all`. Everything missing from `FAST`, plus a reason for the costliest ones — why they are here
 * rather than in the fast run. */
export const SLOW = [
  { file: 'test/cli-paths.test.js', why: 'куда инструмент пишет: на каждый случай свой клон и свой `--write` — без записи не проверить' },
  { file: 'test/crlf.test.js', why: 'выкладка с CRLF: сверка с рабочим деревом на клоне с чужой настройкой переводов строк' },
  { file: 'test/environment.test.js', why: 'герметичность вывода: тот же набор в четырёх чужих окружениях — по клону и прогону на каждое' },
  { file: 'test/check.test.js', why: 'полнота и объяснение на коммитах фикстуры: девять проверок, каждая — прогон команды' },
  { file: 'test/minify.test.js', why: 'настоящее сжатие: числа на всей истории против упрощения, плюс шов отсутствия минификатора' },
  { file: 'test/tokens.test.js', why: 'токены: счёт словарём против оценки на всей истории, кодировка как часть числа' },
  { file: 'test/refusals.test.js', why: 'отказы инструмента: тридцать три запуска, по процессу на отказ, плюс свои клоны (чужой хук, обрезанная история, ветка мимо отчёта) — цена здесь в запусках, а не в объёме' },
  { file: 'test/module.test.js', why: 'модуль в `.js` и гард разбора: шесть сборок на диске и прогон на каждой — гард доказан мутацией, а не словом' },
  { file: 'test/disk.test.js', why: 'сверка с рабочим деревом и три вида потери: по клону на случай, каждый случай — правка на диске' },
  { file: 'test/doctor.test.js', why: 'диагностика на семи состояниях проекта: по прогону инструмента на состояние и на проверку' },
  { file: 'test/cli.test.js', why: 'разбор аргументов и отказы: перебор сочетаний режимов, ключей и слов — каждый случай отдельным процессом' },
  { file: 'test/hook.test.js', why: 'хук автообновления на свежем клоне: настоящие коммиты, слияние, отказы и снятие — самая дорогая проверка набора' },
  { file: 'test/release.test.js', why: 'выпуск из CI: читает описание рабочего процесса текстом — ни git, ни инструмент не запускает' },
  { file: 'test/gates-metrics.test.js', why: 'проба датчика раздувания: шесть линтерных прогонов и обрезка базы — процесс на каждую пробу, иначе проба не доказывает код возврата' },
  { file: 'test/gates-dup.test.js', why: 'проба датчика дублей: своё дерево копий и прогон jscpd на каждый вердикт (снятие базы, живущий клон, новая копия, переносимость базы, отсутствие базы)' },
  { file: 'test/gates-deps.test.js', why: 'проба датчика связей: четыре прогона разборщика на своих маленьких графах — по графу на класс находки' },
  { file: 'test/gates-coverage.test.js', why: 'проба датчика покрытия: вердикты по готовым отчётам плюс сверка базы с деревом — прогонов набора нет, но каждая проба это процесс' },
  { file: 'test/gates-files.test.js', why: 'проба защиты гейт-файлов: свой временный репозиторий, коммиты и аменд — цена в git, а не в объёме' }
];

/* The suite's files: what lies in `test/` and ends with `.test.js`. The list comes from disk rather than from the
 * declaration: a file absent from the declaration has to be noticed. */
export function testFiles() {
  return fs.readdirSync(TEST_DIR).filter((f) => /\.test\.js$/.test(f)).sort()
    .map((f) => 'test/' + f);
}

/* A file's checks: a declaration at the start of a line — the same rule the documentation guard counts checks by. A
 * declaration inside a loop would make the number a conclusion of the code, leaving nothing to compare it with. */
export function checksIn(file) {
  let n = 0;
  fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').forEach((line) => {
    if (/^test\(/.test(line)) n++;
  });
  return n;
}

/* The files of a run: the fast one is the declared list, the full one is the whole set from disk (including a file not yet
 * classified: an unclassified file sees the full run rather than a skip — the guard finds it before CI does). */
export function filesOf(mode) {
  if (mode === 'fast') return FAST.map((e) => e.file);
  if (mode === 'full') return testFiles();
  throw new Error('неизвестный прогон «' + mode + '» (есть: fast, full)');
}
