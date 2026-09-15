import {
  ARTIFACT, CODE_1, CODE_2, CODE_3, CODE_4, CODE_5, CODE_BRANCH, CODE_MAIN, CODE_MERGED,
  CONFIG_MJS_1, CONFIG_MJS_2, HTML_1, HTML_2, LEGACY_JS, LEGACY_JS_2, MODERN_JS, NOTES_1,
  NOTES_2, PACKAGE_JSON, README, STYLE_CSS, TABLE_TOML, WORKLOG_1, WORKLOG_2, WORKLOG_3
} from './content.js';
import { commit, git, initRepo, mergeConflicted, remove, write } from './repo.js';

/* История фикстуры: каждая строка — коммит и то, что он делает. Ловушки
 * перечислены в README, который сборщик пишет рядом с бандлом (`./note.js`).
 *
 * Первые восемь коммитов — плоский список, потому что они и есть плоский список:
 * один за другим, без ветвления. Ветка, слияние и хвост из одиночных правок —
 * отдельные сюжеты, и они названы функциями: у каждого свой предмет, а не «ещё
 * немного коммитов».
 */

export const HISTORY = [
  {
    subject: 'fixture: первый коммит — код, заметки, служебные файлы',
    do: (dir) => {
      write(dir, 'README.md', README);
      write(dir, 'src/code.js', CODE_1);
      write(dir, 'src/legacy.js', LEGACY_JS);
      write(dir, 'src/config.mjs', CONFIG_MJS_1);
      write(dir, 'docs/заметки.md', NOTES_1);
      write(dir, 'notes/crlf.txt', Buffer.from('первая строка\r\nвторая строка\r\n', 'utf8'));
      write(dir, 'package.json', PACKAGE_JSON);
      write(dir, 'WORKLOG.md', WORKLOG_1);
    }
  },
  {
    subject: 'fixture: правка кода и раздел 2 в журнале',
    do: (dir) => {
      write(dir, 'src/code.js', CODE_2);
      write(dir, 'WORKLOG.md', WORKLOG_2);
    }
  },
  {
    subject: 'fixture: только отчёт',
    do: (dir) => write(dir, ARTIFACT, HTML_1)
  },
  {
    subject: 'fixture: смешанный коммит — отчёт вместе с кодом',
    do: (dir) => {
      write(dir, ARTIFACT, HTML_2);
      write(dir, 'src/code.js', CODE_3);
    }
  },
  {
    subject: 'fixture: правка файла под старым именем',
    do: (dir) => write(dir, 'src/legacy.js', LEGACY_JS_2)
  },
  {
    subject: 'fixture: переименование legacy.js в modern.js',
    do: (dir) => {
      git(dir, ['mv', 'src/legacy.js', 'src/modern.js']);
      write(dir, 'src/modern.js', MODERN_JS);
    }
  },
  {
    subject: 'fixture: подпись с <, &, " и > — проверка экранирования',
    do: (dir) => write(dir, 'src/code.js', CODE_4)
  },
  {
    subject: 'fixture: замена символа без изменения объёма',
    do: (dir) => write(dir, 'src/code.js', CODE_5)
  }
];

/* Ветка: правка той же строки, что и на main, — слияние разрешается вручную,
 * поэтому у merge-коммита есть собственные изменения поверх первого родителя. */
function branchStory(dir) {
  git(dir, ['checkout', '-q', '-b', 'feature']);
  write(dir, 'src/code.js', CODE_BRANCH);
  write(dir, 'docs/заметки.md', NOTES_2);
  commit(dir, 'fixture: ветка — правка кода и заметок');

  git(dir, ['checkout', '-q', 'main']);
  write(dir, 'src/code.js', CODE_MAIN);
  write(dir, 'src/config.mjs', CONFIG_MJS_2);
  commit(dir, 'fixture: правка той же строки и служебного модуля');
}

/* Слияние, удаление и возврат файла: три ловушки про одно — клетка «—» против
 * нуля, и строка, которая считается по первому родителю. */
function lossStory(dir) {
  mergeConflicted(dir, 'feature');
  write(dir, 'src/code.js', CODE_MERGED);
  commit(dir, 'fixture: слияние ветки с правкой разрешения конфликта');

  remove(dir, 'notes/crlf.txt');
  commit(dir, 'fixture: удаление файла');

  write(dir, 'notes/crlf.txt', Buffer.from('вернули файл\r\nс другим содержимым\r\n', 'utf8'));
  commit(dir, 'fixture: возврат файла');
}

/* Хвост: раздел журнала от коммита только журнала, незнакомый формат, пустой файл. */
function tailStory(dir) {
  write(dir, 'WORKLOG.md', WORKLOG_3);
  commit(dir, 'fixture: только журнал — раздел 3');

  write(dir, 'src/style.css', STYLE_CSS);
  write(dir, 'data/table.toml', TABLE_TOML);
  commit(dir, 'fixture: разметка, стили и незнакомый формат');

  write(dir, 'src/empty.js', '');
  commit(dir, 'fixture: пустой файл');
}

export function buildRepo(dir) {
  initRepo(dir);
  HISTORY.forEach((step) => { step.do(dir); commit(dir, step.subject); });
  branchStory(dir);
  lossStory(dir);
  tailStory(dir);
}
