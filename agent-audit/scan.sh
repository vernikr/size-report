#!/usr/bin/env bash
# scan.sh — статический слой аудита «пригодность репозитория для ИИ-агентов».
# Без зависимостей кроме git и POSIX-утилит; по желанию использует точный
# токенизатор (см. ниже). Детерминирован: повторный запуск на том же дереве
# даёт те же числа.
#
# Использование:
#   bash agent-audit/scan.sh [путь-к-репо] [--json файл-вывода]
#
# Точность подсчёта токенов: по умолчанию эвристика (±20%):
#   токены ≈ ASCII-байты/4 + не-ASCII-байты/2.2
# (код ≈ 4 байта/токен, кириллица в UTF-8 ≈ 2.2 байта/токен). Если в репо
# установлен `gpt-tokenizer` (node_modules/gpt-tokenizer), для контекст-файлов
# и документов скрипт молча перейдёт на точный подсчёт.
set -u

ROOT="."
JSON_OUT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --json) JSON_OUT="${2:-}"; shift 2 ;;
    *) ROOT="$1"; shift ;;
  esac
done

cd "$ROOT" || { echo "Не могу открыть $ROOT" >&2; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || { echo "$ROOT — не git-репозиторий" >&2; exit 1; }

HAVE_GT=0
if command -v node >/dev/null 2>&1 \
   && node -e "require.resolve('gpt-tokenizer')" >/dev/null 2>&1; then
  HAVE_GT=1
fi

# --- токены ----------------------------------------------------------------
tok_exact() {
  node -e 'const {encode}=require("gpt-tokenizer");const {readFileSync}=require("fs");
  process.stdout.write(String(encode(readFileSync(process.argv[1],"utf8")).length));' "$1" 2>/dev/null
}
tokens_of() {
  # $1 — файл, $2 — 1 если этому файлу разрешён точный подсчёт
  [ -f "$1" ] || { echo 0; return; }
  if [ "$HAVE_GT" = 1 ] && [ "${2:-0}" = 1 ] && [ "$(wc -c <"$1")" -lt 4000000 ]; then
    n=$(tok_exact "$1"); [ -n "$n" ] && { echo "$n"; return; }
  fi
  local bytes ascii non
  bytes=$(wc -c <"$1")
  ascii=$(LC_ALL=C tr -cd '\000-\177' <"$1" | wc -c)
  non=$((bytes - ascii))
  echo $((ascii / 4 + non * 10 / 22))
}

say() { printf '%s\n' "$*"; }
bar() { say ""; say "## $*"; }

FLAGS=""   # накапливаемые находки для JSON
flag() { FLAGS="${FLAGS}${FLAGS:+,}\"$1\""; }

mapfile -t FILES < <(git ls-files)

# --- 1. входной контекст ----------------------------------------------------
bar "1. Входной контекст (автозагружаемая поверхность)"
AGENT_FILES="AGENTS.md CLAUDE.md .cursorrules .windsurfrules .github/copilot-instructions.md .clinerules GEMINI.md"
total_auto=0
auto_rows=""
found_canon=0
canon_count=0
for f in $AGENT_FILES; do
  [ -f "$f" ] || continue
  t=$(tokens_of "$f" 1)
  total_auto=$((total_auto + t))
  auto_rows="${auto_rows}  ${t} ток.  ${f}\n"
  case "$f" in AGENTS.md|CLAUDE.md) canon_count=$((canon_count + 1));; esac
  found_canon=1
done
for f in .cursor/rules/*.mdc; do
  [ -f "$f" ] || continue
  t=$(tokens_of "$f" 1)
  total_auto=$((total_auto + t))
  auto_rows="${auto_rows}  ${t} ток.  ${f}\n"
done
if [ "$found_canon" = 1 ]; then
  say "Найдено агентских файлов:"; printf '%b' "$auto_rows"
  say "Итого автозагрузка: ${total_auto} токенов (порог: ≤2000 хорошо, ≤4000 терпимо)."
  if [ "$total_auto" -le 2000 ]; then say "OK: укладывается в бюджет."
  elif [ "$total_auto" -le 4000 ]; then say "Замечание: на верхней границе бюджета — следить за ростом."
  else say "ПРЕДУПРЕЖДЕНИЕ: автозагрузка раздута."; flag "автоконтекст>${total_auto}ток"
  fi
  if [ "$canon_count" -gt 1 ]; then
    say "ПРЕДУПРЕЖДЕНИЕ: и AGENTS.md, и CLAUDE.md — проверить, что они зеркала, иначе противоречия."
    flag "двойной-канон"
  fi
else
  say "НЕ НАЙДЕНО ни одного агентского контекст-файла (ждём хотя бы AGENTS.md)."
  flag "нет-AGENTS.md"
fi

# --- 2. документы первого уровня --------------------------------------------
bar "2. Документы первого уровня (корень и docs/)"
readme_tok=0
root_docs_tok=0
doc_rows=""
mines=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  t=$(tokens_of "$f" 1)
  root_docs_tok=$((root_docs_tok + t))
  case "$f" in [Rr][Ee][Aa][Dd][Mm][Ee].md) readme_tok=$t;; esac
  mark=""
  if [ "$t" -gt 32000 ]; then mark="  ← МИНА: не влезет в эффективное окно"; mines=$((mines+1));
  elif [ "$t" -gt 8000 ]; then mark="  ← крупный: читать целиком дорого"; fi
  doc_rows="${doc_rows}  ${t} ток.  ${f}${mark}\n"
done < <(git ls-files '*.md' | grep -E '^(docs/)?[^/]*\.md$')
printf '%b' "$doc_rows"
say "Сумма корневых и docs/ документов: ${root_docs_tok} токенов (порог ≤60000)."
[ "$mines" -gt 0 ] && flag "мин-в-документах:${mines}"

# --- 3. масса трекаемого дерева ----------------------------------------------
bar "3. Масса трекаемого дерева"
code_tok=0; docs_tok=0; data_tok=0; other_tok=0
big_files=""
for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  case "$f" in
    *.lock|*lock.yaml|*lock.json|package-lock.json|pnpm-lock.yaml|yarn.lock|go.sum)
      data_tok=$((data_tok + $(tokens_of "$f" 0))); continue ;;
  esac
  t=$(tokens_of "$f" 0)
  case "$f" in
    *.md|*.rst|*.txt|*.adoc) docs_tok=$((docs_tok + t)) ;;
    *.json|*.yaml|*.yml|*.toml|*.ini|*.cfg|*.csv|*.bundle) data_tok=$((data_tok + t)) ;;
    *.js|*.mjs|*.cjs|*.ts|*.tsx|*.jsx|*.py|*.go|*.rs|*.java|*.kt|*.c|*.h|*.cpp|*.hpp|*.rb|*.php|*.cs|*.sh|*.css|*.scss|*.html|*.vue|*.svelte|*.sql) code_tok=$((code_tok + t)) ;;
    *) other_tok=$((other_tok + t)) ;;
  esac
  if [ "$t" -gt 10000 ]; then big_files="${big_files}${t}	${f}\n"; fi
done
total_mass=$((code_tok + docs_tok + data_tok + other_tok))
say "Код: ${code_tok} ток.  Документы: ${docs_tok} ток.  Данные/манифесты: ${data_tok} ток.  Прочее: ${other_tok} ток."
say "Всего: ${total_mass} токенов."
big_count=$(printf '%b' "$big_files" | grep -c . || true)
say "Файлов тяжелее 10000 токенов: ${big_count} (порог: 0 — идеально, ≤3 — терпимо)."
if [ "$big_count" -gt 0 ]; then
  say "Топ-15 по массе:"
  printf '%b' "$big_files" | sort -rn | head -15 | awk -F'\t' '{printf "  %7d ток.  %s\n", $1, $2}'
fi

# --- 4. находимость -----------------------------------------------------------
bar "4. Находимость"
total_n=${#FILES[@]}
dup_stems=$(for f in "${FILES[@]}"; do b=${f##*/}; echo "${b%.*}"; done | sort | uniq -d)
dup_n=$(printf '%s\n' "$dup_stems" | grep -c . || true)
uniq_pct=$((100 - dup_n * 100 / (total_n > 0 ? total_n : 1)))
say "Имена файлов без расширения уникальны у ${uniq_pct}% файлов; неоднозначных имён: ${dup_n}."
[ "$dup_n" -gt 0 ] && printf '%s\n' "$dup_stems" | head -8 | sed 's/^/  дубль: /'
topdir=$(for f in "${FILES[@]}"; do dirname "$f"; done | sort | uniq -c | sort -rn | head -1)
say "Самый густой каталог: $(echo "$topdir" | awk '{print $2}') ($(echo "$topdir" | awk '{print $1}') файлов; порог ≤60)."
maxdepth=$(printf '%s\n' "${FILES[@]}" | awk -F/ '{print NF-1}' | sort -rn | head -1)
say "Максимальная глубина вложенности: ${maxdepth}."

# --- 5. целостность документов -------------------------------------------------
bar "5. Целостность: ссылки и команды в документах"
dead=0; refs=0; runtime=0; dead_list=""
declare -A SEEN_REFS
check_ref() { # $1 — кандидат, $2 — каталог документа
  local r
  r=$(printf '%s' "$1" | sed -e 's/[.,;:!?)]*$//' -e 's|^\./||')
  case "$r" in
    http*|mailto:*|'#'*|@*|*'('*|*')'*|*'$'*|*'<'*|*'>'*|*'*'*|*' '*|*'`'*|*=*|*'{'*|*'}'*|-*) return ;;
  esac
  case "$r" in */) r="${r%/}";; esac   # ссылка на каталог — проверяем без слэша
  case "$r" in
    # голые расширения в прозе («файл `.md`») и их перечисления — не пути
    .md|.js|.mjs|.cjs|.ts|.tsx|.jsx|.py|.go|.rs|.rb|.java|.c|.h|.cpp|.css|.scss|.html|.vue|.json|.yml|.yaml|.toml|.ini|.cfg|.sh|.txt|.rst|.csv|.lock|.svg|.png|.jpg|.bundle) return ;;
  esac
  case "$r" in
    */*) case "$r" in */*) # все сегменты начинаются с точки — перечисление расширений
           bad=0; IFS=/ read -ra segs <<<"$r"; for s in "${segs[@]}"; do case "$s" in .*) bad=$((bad+1));; esac; done
           [ "$bad" -eq "${#segs[@]}" ] && return ;;
         esac ;;
    *.js|*.mjs|*.cjs|*.ts|*.tsx|*.py|*.go|*.rs|*.rb|*.java|*.c|*.h|*.md|*.rst|*.json|*.yml|*.yaml|*.toml|*.ini|*.cfg|*.sh|*.css|*.html|*.txt|*.csv|*.lock|*.svg|*.png) ;;
    *) return ;;                         # идентификаторы вида core.autocrlf — не пути
  esac
  [ -n "${SEEN_REFS[$r]:-}" ] && return
  SEEN_REFS[$r]=1
  refs=$((refs + 1))
  if [ -e "$r" ] || [ -e "$2/$r" ]; then return; fi
  # артефакт времени выполнения (в .gitignore) — не «мёртвая» ссылка, а ожидаемая
  if git check-ignore -q -- "$r" 2>/dev/null || git check-ignore -q -- "$2/$r" 2>/dev/null; then
    runtime=$((runtime + 1)); return
  fi
  dead=$((dead + 1))
  dead_list="${dead_list}  ${r}   (в $2)\n"
}
while IFS= read -r d; do
  [ -f "$d" ] || continue
  dir=$(dirname "$d")
  while IFS= read -r c; do check_ref "$c" "$dir"; done \
    < <(grep -oE '`[^`]{3,120}`' "$d" 2>/dev/null | tr -d '`')
  while IFS= read -r c; do check_ref "$c" "$dir"; done \
    < <(grep -oE '\]\([^)#]{3,120}\)' "$d" 2>/dev/null | sed -e 's/^](\(.*\))$/\1/' -e 's/^\](//' -e 's/)$//')
done < <(git ls-files '*.md' | grep -E '^(docs/)?[^/]*\.md$')
if [ "$refs" -gt 0 ]; then
  dead_pct=$((dead * 100 / refs))
  say "Проверено ссылок/путей в корневых документах: ${refs}; мёртвых: ${dead} (${dead_pct}%); ещё ${runtime} ведут на артефакты времени выполнения (в .gitignore)."
  [ "$dead" -gt 0 ] && { printf '%b' "$dead_list" | sort | uniq | head -20; flag "мёртвые-ссылки:${dead}"; }
else
  say "Ссылок в документах не найдено (нечему устаревать)."
  dead_pct=0
fi

cmd_missing=""
if [ -f package.json ]; then
  scripts=$(node -e 'const s=require(process.argv[1]).scripts||{};console.log(Object.keys(s).join("\n"))' ./package.json 2>/dev/null)
  for doc in AGENTS.md README.md; do
    [ -f "$doc" ] || continue
    while IFS= read -r c; do
      printf '%s\n' "$scripts" | grep -qx "$c" || cmd_missing="${cmd_missing}  $doc: '$c' нет в package.json scripts\n"
    done < <(grep -ohE '(pnpm|npm|yarn) run [A-Za-z0-9:_.-]+' "$doc" 2>/dev/null | awk '{print $NF}' | sort -u)
  done
fi
if [ -n "$cmd_missing" ]; then
  say "Команды из документов, не найденные в манифесте:"; printf '%b' "$cmd_missing"
  flag "команды-вне-манифеста"
else
  say "Все команды 'run X' из AGENTS.md/README нашли соответствия в манифесте (либо манифест не npm-типа)."
fi

# --- 6. свежесть документов -----------------------------------------------------
bar "6. Свежесть документов первого уровня"
head_ts=$(git log -1 --format=%ct 2>/dev/null || echo 0)
while IFS= read -r d; do
  [ -f "$d" ] || continue
  ts=$(git log -1 --format=%ct -- "$d" 2>/dev/null || echo 0)
  days=$(( (head_ts - ts) / 86400 ))
  mark=""; [ "$days" -gt 180 ] && { mark="  ← устаревает: не трогали ${days} дн."; flag "протух-документ:$d"; }
  say "  $d — последнее изменение ${days} дн. назад${mark}"
done < <(git ls-files '*.md' | grep -E '^[^/]*\.md$')

# --- 7. петля обратной связи ------------------------------------------------------
bar "7. Петля обратной связи и воспроизводимость"
fb=0
if [ -f package.json ] && grep -q '"test"' package.json; then say "Тесты: есть скрипт 'test' в package.json."; fb=1; fi
for m in pytest.ini tox.ini pyproject.toml go.mod Cargo.toml pom.xml build.gradle Makefile; do
  [ -f "$m" ] && { say "Возможный вход тестов: $m"; fb=1; }
done
[ "$fb" = 0 ] && say "Вход в тесты не опознан."
ci=0
[ -d .github/workflows ] && { say "CI: GitHub Actions ($(ls .github/workflows | wc -l) воркфлоу)."; ci=1; }
for m in .gitlab-ci.yml Jenkinsfile .circleci .buildkite; do [ -e "$m" ] && { say "CI: $m"; ci=1; }; done
lock=0
for m in pnpm-lock.yaml package-lock.json yarn.lock bun.lock poetry.lock uv.lock Cargo.lock go.sum Gemfile.lock composer.lock; do
  [ -f "$m" ] && { say "Локфайл: $m"; lock=1; }
done
pins=0
[ -f package.json ] && grep -qE '"(packageManager|engines)"' package.json && { say "Пины среды: есть (packageManager/engines)."; pins=1; }
hooks=0
for m in .githooks .husky .pre-commit-config.yaml; do [ -e "$m" ] && { say "Хуки: $m"; hooks=1; }; done
[ "$(git config core.hooksPath || true)" ] && hooks=1

# --- 8. история --------------------------------------------------------------------
bar "8. Дисциплина истории (последние 200 коммитов)"
hist=$(git log --no-merges -200 --pretty=format:'@' --numstat 2>/dev/null | awk '
  /^@/ { if (seen) print l, f; seen=1; l=0; f=0; next }
  NF>=3 && $1!="-" { l+=$1+$2; f++ }
  END { if (seen) print l, f }' | sort -n)
n_commits=$(printf '%s\n' "$hist" | grep -c . || true)
hist_na=0
if [ "$n_commits" -ge 10 ]; then
  p50l=$(printf '%s\n' "$hist" | awk '{print $1}' | awk -v p=50 -v n="$n_commits" 'NR==int(n*p/100)+1{print}')
  p75l=$(printf '%s\n' "$hist" | awk '{print $1}' | awk -v p=75 -v n="$n_commits" 'NR==int(n*p/100)+1{print}')
  p75f=$(printf '%s\n' "$hist" | awk '{print $2}' | sort -n | awk -v n="$n_commits" 'NR==int(n*75/100)+1{print}')
  say "Коммитов в выборке: ${n_commits}; строки: p50=${p50l}, p75=${p75l}; файлов в коммите: p75=${p75f}."
  [ "${p75l:-0}" -le 1000 ] && say "OK: коммиты мелкие — историю дёшево читать агенту." \
    || say "ПРЕДУПРЕЖДЕНИЕ: крупные коммиты — дорогая история для агента."
else
  hist_na=1; p50l=0; p75l=0; p75f=0
  say "Коммитов в выборке: ${n_commits} — статистика истории недостоверна (N/A)."
fi

# --- скоринг ------------------------------------------------------------------------
bar "9. Сводный балл"
# A. входной контекст (20)
a=0
[ "$found_canon" = 1 ] && a=$((a + 5))
if [ "$total_auto" -le 2000 ]; then a=$((a + 5)); elif [ "$total_auto" -le 4000 ]; then a=$((a + 2)); fi
if [ "$readme_tok" -gt 0 ] && [ "$readme_tok" -le 12000 ]; then a=$((a + 5)); elif [ "$readme_tok" -eq 0 ]; then a=$((a + 2)); fi
[ "$canon_count" -le 1 ] && a=$((a + 5))
# B. достоверность (25)
b=0
if [ "$refs" -gt 0 ]; then
  if [ "$dead" -eq 0 ]; then b=$((b + 12)); elif [ "$dead_pct" -le 3 ]; then b=$((b + 8)); elif [ "$dead_pct" -le 10 ]; then b=$((b + 4)); fi
else
  b=$((b + 12))
fi
if [ -z "$cmd_missing" ]; then b=$((b + 8)); else b=$((b + 4)); fi
[ "$canon_count" -le 1 ] && b=$((b + 5))
# C. масса (20)
biggest_doc=$(printf '%b' "$doc_rows" | awk '{print $1}' | sort -rn | head -1); biggest_doc=${biggest_doc:-0}
c=0
if [ "$biggest_doc" -le 8000 ]; then c=$((c + 8)); elif [ "$biggest_doc" -le 32000 ]; then c=$((c + 4)); fi
[ "$root_docs_tok" -le 60000 ] && c=$((c + 6))
if [ "$big_count" -eq 0 ]; then c=$((c + 6)); elif [ "$big_count" -le 3 ]; then c=$((c + 4)); elif [ "$big_count" -le 8 ]; then c=$((c + 2)); fi
# D. находимость (15)
d=0
[ "$uniq_pct" -ge 95 ] && d=$((d + 6))
maxdirc=$(echo "$topdir" | awk '{print $1}')
[ "${maxdirc:-0}" -le 60 ] && d=$((d + 4))
if [ "$code_tok" -le 200000 ]; then d=$((d + 5)); elif [ "$code_tok" -le 600000 ]; then d=$((d + 3)); else d=$((d + 1)); fi
# E. обратная связь (20)
e=0
[ "$fb" = 1 ] && e=$((e + 8))
[ "$ci" = 1 ] && e=$((e + 4))
[ "$lock" = 1 ] && e=$((e + 2))
[ "$pins" = 1 ] && e=$((e + 2))
[ "$hooks" = 1 ] && e=$((e + 2))
{ [ "$hist_na" = 1 ] || [ "${p75l:-0}" -le 1000 ]; } && [ "$n_commits" -gt 0 ] && e=$((e + 2))
score=$((a + b + c + d + e))
grade="D"
if [ "$score" -ge 85 ]; then grade="A — агентный"; 
elif [ "$score" -ge 70 ]; then grade="B — дружелюбный";
elif [ "$score" -ge 55 ]; then grade="C — рабочий с оговорками";
fi
say "Входной контекст:      ${a}/20"
say "Достоверность:         ${b}/25"
say "Масса и отвлекатели:   ${c}/20"
say "Находимость:           ${d}/15"
say "Обратная связь:        ${e}/20"
say "ИТОГО: ${score}/100 — ${grade}"
say "(токены — эвристика ±20%; точный режим: $([ "$HAVE_GT" = 1 ] && echo да || echo нет))"

if [ -n "$JSON_OUT" ]; then
  {
    echo '{'
    echo "  \"score\": ${score},"
    echo "  \"grade\": \"${grade%% —*}\","
    echo "  \"dimensions\": {\"entry\": ${a}, \"trust\": ${b}, \"mass\": ${c}, \"discoverability\": ${d}, \"feedback\": ${e}},"
    echo "  \"metrics\": {\"auto_tokens\": ${total_auto}, \"readme_tokens\": ${readme_tok}, \"root_docs_tokens\": ${root_docs_tok}, \"code_tokens\": ${code_tok}, \"dead_refs\": ${dead}, \"dead_refs_pct\": ${dead_pct:-0}, \"runtime_refs\": ${runtime}, \"big_files_over_10k\": ${big_count}, \"unique_stems_pct\": ${uniq_pct}, \"commit_p75_lines\": ${p75l:-0}},"
    echo "  \"flags\": [${FLAGS}]"
    echo '}'
  } >"$JSON_OUT"
  say "JSON записан в ${JSON_OUT}"
fi
