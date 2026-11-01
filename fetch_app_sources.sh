#!/usr/bin/env bash
#
# fetch_app_sources.sh -- refresh the hosted web apps in apps/ from their
# source repositories under https://github.com/jwkunz.
#
# Usage:
#   ./fetch_app_sources.sh [--no-build] [--list] [app ...]
#
#   app          One or more app keys (see --list). Default: all apps.
#   --no-build   Skip apps that need a local build step (Inspector Blanque,
#                RF Ranger, Py-Whole, Post Fix Pro).
#   --list       Print the app keys and their source repos, then exit.
#
# Requirements: git, gh (authenticated -- several repos are private).
# Build steps additionally need: python3 (Inspector Blanque, Post Fix Pro),
# node + npm (RF Ranger), node (Py-Whole).
#
# The script only updates files in apps/. It never commits or pushes: review
# the result with `git status` / `git diff --stat` afterwards.
#
# NOTE: the build steps run code from the cloned source repos (npm ci, build
# scripts). That is intentional -- they are your own repos -- but review the
# repos first if you have not touched them in a while.
#
# Destination files use stable, unversioned names (e.g. apps/rf_ranger.html) so
# the site links never need to change when an app is updated.

set -euo pipefail

OWNER="jwkunz"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPS_DIR="${ROOT_DIR}/apps"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

DO_BUILD=1
SELECTED=()

# key | repo | needs build (0/1)
APP_TABLE=(
  "post_fix_pro|Post-Fix-Pro|1"
  "inspector_blanque|Inspector_Blanque|1"
  "rf_ranger|RF_Ranger|1"
  "count_it_up|count_it_up|0"
  "turbo_guacamole|turbo-guacamole|0"
  "wordle_wizard|wordle_wizard|0"
  "py_whole|py_whole|1"
  "green_olive|Green_Olive|0"
  "euclids_compass|Euclids-Compass|0"
  "violet_mango|Violet-Mango|0"
  "linear_lens_liner|Linear_Lens_Liner|0"
  "gravitated|Gravitated|0"
  "gift_giver|Gift_Giver|0"
)

log()  { printf '==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"; }

clone() { # clone <repo> -> prints the checkout path
  local repo="$1" dir="${WORK_DIR}/$1"
  gh repo clone "${OWNER}/${repo}" "${dir}" -- --depth 1 --quiet >&2
  printf '%s\n' "${dir}"
}

# install <src file> <dest path relative to apps/>
install_file() {
  local src="$1" dest="${APPS_DIR}/$2"
  [[ -f "${src}" ]] || die "expected build output not found: ${src}"
  mkdir -p "$(dirname "${dest}")"
  cp -f "${src}" "${dest}"
  log "updated apps/$2"
}

# ---------------------------------------------------------------------------
# Per-app fetchers. Destination file names are kept as they are today so the
# links in apps.md and _portfolio/ keep working; only the contents change.
# ---------------------------------------------------------------------------

fetch_post_fix_pro() {
  need python3
  local d; d="$(clone Post-Fix-Pro)"
  # Packages the checked-in dist/ tree into one self-contained HTML file
  # (post_fix_pro_vX_Y_Z.html in the repo root) without needing wasm-pack.
  ( cd "${d}" && ./scripts/single_file_package.sh --no-build >&2 )
  local out; out="$(ls "${d}"/post_fix_pro_v*.html 2>/dev/null | head -n1 || true)"
  [[ -n "${out}" ]] || die "Post Fix Pro: single-file output not found"
  log "Post Fix Pro upstream version: $(tr -d '[:space:]' < "${d}/dist/VERSION" 2>/dev/null || echo unknown)"
  install_file "${out}" post_fix_pro.html
}

fetch_inspector_blanque() {
  need python3
  local d; d="$(clone Inspector_Blanque)"
  ( cd "${d}" && ./scripts/build_release.sh >&2 )
  local out; out="$(ls "${d}"/dist/Inspector_Blanque_v*_single_file.html 2>/dev/null | head -n1 || true)"
  [[ -n "${out}" ]] || die "Inspector Blanque: single-file output not found"
  log "Inspector Blanque upstream version: $(tr -d '[:space:]' < "${d}/VERSION")"
  install_file "${out}" inspector_blanque.html
}

fetch_rf_ranger() {
  need python3; need node; need npm
  local d; d="$(clone RF_Ranger)"
  ( cd "${d}" && ./scripts/build-release.sh >&2 )
  local out; out="$(ls "${d}"/build/RF_Ranger_v*_single_file.html 2>/dev/null | head -n1 || true)"
  [[ -n "${out}" ]] || die "RF Ranger: single-file output not found"
  log "RF Ranger upstream version: $(tr -d '[:space:]' < "${d}/VERSION")"
  install_file "${out}" rf_ranger.html
}

fetch_count_it_up() {
  local d; d="$(clone count_it_up)"
  install_file "${d}/dist/count_it_up_single_file.html" count_it_up_single_file.html
}

fetch_turbo_guacamole() {
  local d; d="$(clone turbo-guacamole)"
  install_file "${d}/dist/turbo_guacamole_single_file.html" turbo_guacamole_single_file.html
}

fetch_wordle_wizard() {
  # The single-file build is published as a release asset.
  local d="${WORK_DIR}/wordle_wizard_release"
  mkdir -p "${d}"
  gh release download -R "${OWNER}/wordle_wizard" -p '*_single_file.html' -D "${d}" --clobber >&2
  local out; out="$(ls "${d}"/*_single_file.html 2>/dev/null | head -n1 || true)"
  [[ -n "${out}" ]] || die "Wordle Wizard: release asset not found"
  log "Wordle Wizard release asset: $(basename "${out}")"
  install_file "${out}" wordle_wizard.html
}

fetch_py_whole() {
  need node
  local d; d="$(clone py_whole)"
  ( cd "${d}" && ./scripts/build_static_web_package.sh >&2 )
  local out="${d}/dist/py_whole_web"
  [[ -d "${out}" ]] || die "Py-Whole: static package not found at ${out}"
  log "Py-Whole upstream version: $(tr -d '[:space:]' < "${d}/VERSION" 2>/dev/null || echo unknown)"
  mkdir -p "${APPS_DIR}/py_whole"
  cp -a "${out}/." "${APPS_DIR}/py_whole/"
  log "updated apps/py_whole/"
  warn "Py-Whole: previous hosted copies were patched after building; check 'git diff' before committing."
}

fetch_green_olive() {
  local d; d="$(clone Green_Olive)"
  mkdir -p "${APPS_DIR}/green_olive"
  cp -a "${d}/gps-sim.html" "${d}/help.html" "${d}/LICENSE" "${d}/css" "${d}/js" "${APPS_DIR}/green_olive/"
  log "updated apps/green_olive/"
}

fetch_euclids_compass() {
  local d; d="$(clone Euclids-Compass)"
  install_file "${d}/euclids-compass.html" euclids_compass.html
}

fetch_violet_mango() {
  local d; d="$(clone Violet-Mango)"
  install_file "${d}/violet-mango.html" violet_mango.html
}

fetch_linear_lens_liner() {
  local d; d="$(clone Linear_Lens_Liner)"
  install_file "${d}/Linear_Lens_Liner.html" linear_lens_liner.html
}

fetch_gift_giver() {
  local d; d="$(clone Gift_Giver)"
  install_file "${d}/gift_giver.html" gift_giver.html
}

fetch_gravitated() {
  # Private repo; only the web simulation is published, not the Android project.
  local d; d="$(clone Gravitated)"
  install_file "${d}/app/src/web/gravitated.html" gravitated.html
}

# ---------------------------------------------------------------------------

list_apps() {
  printf '%-20s %-22s %s\n' KEY REPO BUILD
  local row key repo build
  for row in "${APP_TABLE[@]}"; do
    IFS='|' read -r key repo build <<<"${row}"
    printf '%-20s %-22s %s\n' "${key}" "${OWNER}/${repo}" "$([[ ${build} == 1 ]] && echo yes || echo no)"
  done
}

for arg in "$@"; do
  case "${arg}" in
    --no-build) DO_BUILD=0 ;;
    --list)     list_apps; exit 0 ;;
    -h|--help)  sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)         die "unknown option: ${arg}" ;;
    *)          SELECTED+=("${arg}") ;;
  esac
done

need git; need gh
gh auth status >/dev/null 2>&1 || die "gh is not authenticated; run 'gh auth login' (private repos need it)"

# Resolve which apps to run.
TO_RUN=()
for row in "${APP_TABLE[@]}"; do
  IFS='|' read -r key repo build <<<"${row}"
  if [[ ${#SELECTED[@]} -gt 0 ]]; then
    match=0
    for s in "${SELECTED[@]}"; do [[ "${s}" == "${key}" ]] && match=1; done
    [[ ${match} -eq 1 ]] || continue
  fi
  TO_RUN+=("${key}|${build}")
done
if [[ ${#SELECTED[@]} -gt 0 ]]; then
  for s in "${SELECTED[@]}"; do
    found=0
    for row in "${APP_TABLE[@]}"; do [[ "${row%%|*}" == "${s}" ]] && found=1; done
    [[ ${found} -eq 1 ]] || die "unknown app '${s}' (try --list)"
  done
fi

FAILED=()
for entry in "${TO_RUN[@]}"; do
  IFS='|' read -r key build <<<"${entry}"
  if [[ "${build}" == 1 && ${DO_BUILD} -eq 0 ]]; then
    log "skipping ${key} (needs a build; --no-build given)"
    continue
  fi
  log "fetching ${key}"
  # Run in a subshell so one failing app does not abort the rest.
  if ! ( "fetch_${key}" ); then
    warn "${key} failed"
    FAILED+=("${key}")
  fi
done

echo
log "done. Review changes with: git status --short apps/ && git diff --stat"
if [[ ${#FAILED[@]} -gt 0 ]]; then
  warn "failed: ${FAILED[*]}"
  exit 1
fi
