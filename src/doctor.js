import { EXIT, Refusal, cliCommand } from './refusal.js';
import { GIT_PINS, git, gitEnv } from './git.js';
import { loadConfig } from './config.js';
import { TOOL_PKG } from './tool.js';
import { coverage, coverageText } from './check.js';
import { hookStatus } from './hook.js';
import { derivedSummary } from './project.js';
import { minifier } from './minify.js';
import { tokenizer } from './tokens.js';

/* Diagnostics in a single answer (`size doctor`): does the machine stand behind the numbers, what counts
 * the metrics here and now, are the settings usable, is everything from the history covered. It computes
 * nothing of its own: coverage is the same answer `size check` gives (`coverage`), the environment is this
 * machine's facts, and the dependencies are the very loaders the sensors use. There is no second calculation
 * in the package.
 *
 * The rule of the answer: `ok` means "nothing to do", and every finding names its level. `action` means
 * something has to be done (with a fix command where one exists); `note` is an observation — useful to know,
 * nothing to do. One `verdictOf` at the end counts the exit code: the reading steps only name the kind of
 * trouble (`troubles`), while both the order of the kinds and each of their codes come from one list,
 * `WEIGHT`. A step has no code of its own, so those two answers cannot drift apart.
 *
 * What the answer does not do: it does not say whether the columns are chosen "correctly" (the project knows
 * that), and it does not guess where there are no data — a missing answer is named in words (`coverage: null`
 * and a finding carrying the reason).
 */

/* The environment: what machine this is and what it says about the numbers. With no answer from git the
 * answer is honestly incomplete (`git: null`) rather than invented. */
function environment(root) {
  const env = {
    node: process.version,
    platform: process.platform,
    root: root,
    git: null,
    shallow: null,
    pins: GIT_PINS.slice(),
    locale: gitEnv().LC_ALL
  };
  try {
    env.git = git(root, ['--version']).trim();
    env.shallow = git(root, ['rev-parse', '--is-shallow-repository']).trim() === 'true';
  } catch (_e) {
    // git did not answer — the finding will say so, rather than an invented value.
  }
  return env;
}

/* Dependencies: what counts the metrics here and now. The very loaders the sensors use are asked
 * (`minifier`, `tokenizer`), so the answer cannot drift from the number: without the minifier `min` counts
 * by approximation, without the dictionary `tok` by estimate.
 *
 * Only what the project actually asked for is loaded: the dictionary weighs megabytes, and touching it for
 * the sake of an "installed" line would mean paying for an answer the numbers never needed (the same rule as
 * in the report: `test/tokens.test.js`). An unwanted sensor is named unneeded rather than unknown — it does
 * not affect accuracy, and that is the answer; "unknown" stays for the case where the settings are unreadable
 * and there is nobody to ask. */
const UNREADABLE = 'неизвестно: настройки нечитаемы';

/* Asked — ask the loader; not asked — say so in words and do not pay for it. */
function entry(asked, name, metric, load, note) {
  if (asked !== true) return { name: name, metric: metric, present: null, note: note };
  const { tool, version } = load();
  return { name: name, metric: metric, present: tool !== null, version: version };
}

function dependencies(cfg) {
  const asksMinify = cfg === null ? null : cfg.minify.engine === 'esbuild';
  const asksTokens = cfg === null ? null : cfg.metrics.indexOf('tok') >= 0;
  return [
    entry(asksMinify, 'esbuild', 'min', () => minifier(),
      asksMinify === null ? UNREADABLE : 'не спрашивается: «minify» считает снятием балласта'),
    entry(asksTokens, 'gpt-tokenizer', 'tok', () => tokenizer(cfg.tokens),
      asksTokens === null ? UNREADABLE : 'не спрашивается: метрики ' + cfg.metrics.join(' '))
  ];
}

/* Settings: with unreadable ones the answer is honestly incomplete (there is nothing to count coverage with),
 * and the cause is a finding rather than a refusal — diagnostics exist to name the cause and its fix, and the
 * refusal's text carries both. A step only **names** the weight of a trouble (`troubles`); whether it outranks
 * another is not its business — `verdictOf` decides.
 *
 * Settings derived from the project are an observation here rather than a trouble: the project works, but the
 * numbers in its report depend on what the tool guessed about it — hence a `note` finding (it carries no exit
 * code) and the `derived` field in the answer. */
function readConfig(root, configFile) {
  try {
    const cfg = loadConfig(configFile, root);
    const derived = cfg.derived === true;
    return {
      cfg: cfg,
      report: {
        file: configFile, ok: true, derived: derived,
        columns: cfg.columns.length, metrics: cfg.metrics
      },
      findings: derived
        ? [{ level: 'note', what: derivedSummary(cfg), fix: 'закрепите их файлом: ' + cliCommand('--init') }]
        : [],
      troubles: []
    };
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    return {
      cfg: null,
      report: { file: configFile, ok: false, problem: e.message },
      findings: [{ level: 'action', what: e.message }],
      troubles: ['config']
    };
  }
}

/* The hook: two findings, each with a fix of its own. They carry neither weight nor an exit code of their
 * own — the report is built without the hook too, so a broken hook changes only the `ok` verdict. */
function hookFindings(hooks) {
  const found = [];
  if (!hooks.installed) return found;
  if (hooks.enabled === false) {
    found.push({
      level: 'action',
      what: 'хук установлен, но автоматика выключена настройкой hooks.enabled: отчёт обновляется руками',
      fix: 'верните «"hooks": {"enabled": true}» в файл настроек или снимите хук: ' + cliCommand('uninstall-hook')
    });
  }
  if (hooks.last !== null && HOOK_BAD.indexOf(hooks.last.result) >= 0) {
    found.push({
      level: 'action',
      what: 'хук: последний запуск не пересобрал отчёт — ' + hooks.last.why,
      fix: 'починьте то, на что жалуется причина, и пересоберите отчёт: ' + cliCommand('--write')
    });
  }
  return found;
}

/* Coverage is the same answer `size check` gives, plus the kind of trouble if there is one: an incomplete path
 * or an approximating sensor (the kinds weigh differently — `WEIGHT`), with incompleteness outranking, because
 * without it there are no numbers at all.
 * What becomes a finding and what does not: the report holds the whole coverage block (the same text as
 * `size check`), so incompleteness is not retold a second time — it weighs. Sensors do get a finding:
 * `size check` prints them as a `!` line, while here they are part of the answer. */
function readCoverage(cfg, root, configFile) {
  if (cfg === null) {
    return {
      report: null,
      findings: [{
        level: 'note',
        what: 'покрытие не считалось: настройки нечитаемы — почините их и спросите снова'
      }],
      troubles: []
    };
  }
  try {
    const report = coverage(cfg, root, configFile);
    return {
      report: report,
      findings: report.sensors.map((gap) => ({ level: 'action', what: gap.why, fix: gap.fix })),
      troubles: report.ok ? (report.sensors.length > 0 ? ['sensor'] : []) : ['coverage']
    };
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    /* Two things refuse inside coverage, of different kinds: a truncated history gets a kind of its own
     * (`assertFullHistory`), while an unparsed file counts as settings — the number is missing because of them,
     * and its fix is in the settings too. The kind is picked by the refusal's code: those two codes are the
     * whole choice. */
    return {
      report: null,
      findings: [{ level: 'action', what: e.message }],
      troubles: [e.code === EXIT.SHALLOW ? 'history' : 'config']
    };
  }
}

/* The weight of troubles — the whole order of importance, and one for the entire module: the keys run by
 * importance, the values are each kind's code. The exit code comes from the most important thing found rather
 * than from the last one found: first what leaves nothing to count with (settings, history), then incomplete
 * coverage, then the caveat about the count.
 * The hook is not in this list: the report is built without it too (see `hookFindings`). */
const WEIGHT = {
  config: EXIT.CONFIG,
  history: EXIT.SHALLOW,
  coverage: EXIT.VIOLATION,
  sensor: EXIT.SENSOR
};

/* The verdict — the one place where troubles turn into an exit code and into `ok`. "Nothing to do" means no
 * action finding and counted complete coverage: with no coverage there is no verdict, because there is nothing
 * left to count (see the note in `readCoverage`). */
function verdictOf(rep, troubles) {
  const found = Object.keys(WEIGHT).filter((kind) => troubles.indexOf(kind) >= 0);
  rep.exit = found.length === 0 ? EXIT.OK : WEIGHT[found[0]];
  rep.ok = rep.coverage !== null && rep.coverage.ok
    && !rep.findings.some((f) => f.level === 'action');
  return rep;
}

export function doctor(root, configFile) {
  const config = readConfig(root, configFile);
  const hooks = hooksReport(root, config.cfg);
  const cov = readCoverage(config.cfg, root, configFile);
  const rep = {
    schema: 1,
    ok: false,
    tool: { name: TOOL_PKG.name, version: TOOL_PKG.version },
    environment: environment(root),
    config: config.report,
    dependencies: dependencies(config.cfg),
    hooks: hooks,
    coverage: cov.report,
    findings: config.findings.concat(hookFindings(hooks), cov.findings),
    exit: EXIT.OK
  };
  return verdictOf(rep, config.troubles.concat(cov.troubles));
}

/* The outcome of the hook's last run in words: it tells a person what happened after a commit without looking
 * into `.git`. */
const HOOK_RESULT = {
  committed: 'отчёт пересобран и закоммичен',
  rebuilt: 'отчёт пересобран без коммита',
  unchanged: 'менять было нечего',
  refused: 'отказ',
  failed: 'ошибка',
  skipped: 'пропущен'
};
// The outcomes that call for action: a refusal by the tool and its own error.
const HOOK_BAD = ['refused', 'failed'];

/* The state of the hook: whether it is installed, switched on by the settings, and how its last run ended.
 * "Not installed" is not a finding: the automation is installed by an explicit command, and its absence is the
 * project's decision rather than forgetfulness. */
function hooksReport(root, cfg) {
  const status = hookStatus(root);
  return {
    installed: status.installed,
    files: status.files,
    enabled: cfg === null ? null : cfg.hooks.enabled,
    last: status.last
  };
}

function hookLine(hooks) {
  if (!hooks.installed) return 'не установлен (ставится командой ' + cliCommand('install-hook') + ')';
  const last = hooks.last === null
    ? 'ещё не запускался'
    : 'последний запуск ' + hooks.last.at + ' — ' + (HOOK_RESULT[hooks.last.result] || hooks.last.result)
      + (hooks.last.commit ? ' (' + hooks.last.commit + ')' : '')
      + (hooks.last.why ? ': ' + hooks.last.why.split('\n')[0] : '');
  return hooks.files.join(', ') + (hooks.enabled === false ? ' (выключен настройкой)' : '') + '; ' + last;
}

/* The text for a person. Coverage is printed by `coverageText` — the same one `size check` uses: two answers
 * about one thing must not drift apart in wording. */
export function doctorText(rep) {
  const env = rep.environment;
  const lines = [];
  lines.push((rep.ok ? '✓ ' : '✗ ') + rep.tool.name + ' ' + rep.tool.version + ': диагностика ' + env.root);
  lines.push('  окружение: Node ' + env.node + ', ' + env.platform + ', '
    + (env.git === null ? 'git недоступен' : env.git)
    + (env.shallow === null ? '' : env.shallow ? ', история обрезана' : ', история полная'));
  // The pins are a mechanism rather than decoration: the engine sets them itself at the call boundary, so the
  // machine's settings do not reach the numbers (guarded by `test/environment.test.js`).
  lines.push('  git читается с закреплениями: ' + env.pins.join(', ') + '; локаль ' + env.locale
    + ' (настройки машины на числа не влияют)');
  lines.push('  настройки: ' + (rep.config.ok
    ? (rep.config.derived ? 'выводятся из проекта (файла нет)' : rep.config.file)
      + ' — ' + rep.config.columns + ' колонок, метрики ' + rep.config.metrics.join(' ')
    : rep.config.file + ' — нечитаемы'));
  lines.push('  зависимости: ' + rep.dependencies.map((d) => d.name
    + (d.present === null ? ' — ' + d.note : d.present ? ' ' + d.version + ' есть' : ' нет')
    + ' (' + d.metric + ')').join(', '));
  lines.push('  хук: ' + hookLine(rep.hooks));
  if (rep.coverage) lines.push(coverageText(rep.coverage));
  rep.findings.forEach((f) => {
    lines.push((f.level === 'action' ? '✗ ' : '· ') + f.what);
    if (f.fix) lines.push('  починка: ' + f.fix);
  });
  return lines.join('\n');
}
