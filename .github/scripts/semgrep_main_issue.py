#!/usr/bin/env python3
"""Print all semgrep findings as markdown for a GitHub issue (push to main)."""
import json
import os
import sys

data = json.load(open("semgrep-results.json"))
results = data.get("results", [])

if not results:
    sys.exit(0)

trigger = os.environ.get("COMMIT_MESSAGE", "unknown commit").splitlines()[0]
lines = ["## Semgrep findings introduced on main\n"]
lines.append(f"**Triggered by:** {trigger}\n")
lines.append("This likely came in via a dependency update or direct push.\n")
for r in results:
    path = r["path"]
    line = r["start"]["line"]
    rule = r["check_id"]
    msg = r["extra"].get("message", "").strip().splitlines()[0]
    tag = " _(autofix available)_" if "fix" in r.get("extra", {}) else ""
    lines.append(f"- **{rule}** — `{path}:{line}`{tag}  \n  {msg}")

print("\n".join(lines))
