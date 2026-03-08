#!/usr/bin/env python3
"""Print manual semgrep findings (those without autofixes) as markdown for a PR comment."""
import json
import sys

data = json.load(open("semgrep-results.json"))
results = [r for r in data.get("results", []) if "fix" not in r.get("extra", {})]

if not results:
    sys.exit(0)

lines = ["## Semgrep findings requiring manual fixes\n"]
lines.append("These findings have no automatic fix and require manual remediation.\n")
for r in results:
    path = r["path"]
    line = r["start"]["line"]
    rule = r["check_id"]
    msg = r["extra"].get("message", "").strip().splitlines()[0]
    lines.append(f"- **{rule}** — `{path}:{line}`  \n  {msg}")

print("\n".join(lines))
