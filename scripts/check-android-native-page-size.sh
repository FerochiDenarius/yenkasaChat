#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SO_ROOT="${1:-$ROOT_DIR/app/build/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out/lib}"
READELF="${READELF:-}"

if [[ -z "$READELF" ]]; then
  READELF="$(find "$HOME/Library/Android/sdk/ndk" -path '*/bin/llvm-readelf' -type f 2>/dev/null | sort -V | tail -n 1 || true)"
fi

if [[ ! -x "$READELF" ]]; then
  echo "llvm-readelf not found. Install Android NDK or set READELF=/path/to/llvm-readelf." >&2
  exit 2
fi

if [[ ! -d "$SO_ROOT" ]]; then
  echo "Native library folder not found: $SO_ROOT" >&2
  echo "Run ./gradlew :app:mergeDebugNativeLibs first." >&2
  exit 2
fi

failed=0
while IFS= read -r -d '' so_file; do
  aligns="$("$READELF" -l "$so_file" | awk '/LOAD/ { print $NF }' | sort -u)"
  bad_align=0
  while IFS= read -r align; do
    [[ -z "$align" ]] && continue
    if (( align < 0x4000 )); then
      bad_align=1
    fi
  done <<< "$aligns"

  if [[ "$bad_align" -ne 0 ]]; then
    echo "FAIL $so_file align=$aligns"
    failed=1
  else
    echo "OK   $so_file align=$aligns"
  fi
done < <(find "$SO_ROOT" -name '*.so' -type f -print0 | sort -z)

if [[ "$failed" -ne 0 ]]; then
  echo "One or more native libraries are not aligned for 16 KB page sizes." >&2
  exit 1
fi

echo "All checked native libraries have 16 KB-compatible LOAD alignment."
