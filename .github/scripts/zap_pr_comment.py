#!/usr/bin/env python3
"""Format ZAP baseline JSON report as a markdown PR comment."""
import argparse
import json
import re
import sys
from pathlib import Path

RISK_LABEL = {"3": "🔴 High", "2": "🟠 Medium", "1": "🟡 Low", "0": "🔵 Info"}
CONFIDENCE_LABEL = {"4": "Confirmed", "3": "High", "2": "Medium", "1": "Low", "0": "False Positive"}


def strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def load_ignored_rules() -> set[str]:
    ignored = set()
    rules_path = Path(".zap/rules.tsv")
    if not rules_path.exists():
        return ignored
    for line in rules_path.read_text().splitlines():
        line = line.split("#")[0].strip()
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) >= 2 and parts[1].strip() == "IGNORE":
            ignored.add(parts[0].strip())
    return ignored


def parse_prev_rule_ids(prev_comment: str) -> set[str]:
    """Extract plugin IDs from a previous ZAP comment (e.g. `[10038]`)."""
    return set(re.findall(r"`\[(\d+)\]`", prev_comment))


def format_alert(alert: dict) -> list[str]:
    risk = RISK_LABEL.get(str(alert.get("riskcode", "0")), "Info")
    confidence = CONFIDENCE_LABEL.get(str(alert.get("confidence", "2")), "Medium")
    name = alert["name"]
    plugin_id = alert.get("pluginid", "")
    cwe_id = alert.get("cweid", "")
    count = alert.get("count", "?")
    desc = strip_html(alert.get("desc", ""))
    solution = strip_html(alert.get("solution", ""))
    instances = alert.get("instances", [])

    cwe_link = f" · [CWE-{cwe_id}](https://cwe.mitre.org/data/definitions/{cwe_id}.html)" if cwe_id and cwe_id != "-1" else ""

    lines = []
    lines.append(f"### {risk} — {name} `[{plugin_id}]`{cwe_link}")
    lines.append(f"**Confidence:** {confidence} · **Instances:** {count}\n")
    if desc:
        lines.append(f"{desc}\n")
    for instance in instances:
        url = instance.get("uri", "")
        method = instance.get("method", "")
        param = instance.get("param", "")
        evidence = strip_html(instance.get("evidence", ""))
        detail = f"`{method}` {url}"
        if param:
            detail += f" · param: `{param}`"
        if evidence:
            detail += f" · evidence: `{evidence}`"
        lines.append(f"- {detail}")
    if solution:
        lines.append(f"\n**Remediation:** {solution}")
    lines.append("")
    return lines


def strikethrough(text: str) -> str:
    return "\n".join(f"~~{line}~~" if line.strip() else line for line in text.splitlines())


parser = argparse.ArgumentParser()
parser.add_argument("--prev-comment", default="", help="Path to previous ZAP PR comment body")
parser.add_argument("--commit", default="", help="Current commit SHA for resolved finding notes")
args = parser.parse_args()

try:
    data = json.load(open("report_json.json"))
except FileNotFoundError:
    print("No ZAP report found.", file=sys.stderr)
    sys.exit(1)

ignored_rules = load_ignored_rules()

# Active findings (not suppressed)
active_alerts = {}
for site in data.get("site", []):
    for alert in site.get("alerts", []):
        pid = alert.get("pluginid", "")
        if pid not in ignored_rules:
            active_alerts[pid] = alert

# Previously reported rule IDs
prev_ids: set[str] = set()
if args.prev_comment:
    prev_path = Path(args.prev_comment)
    if prev_path.exists():
        prev_ids = parse_prev_rule_ids(prev_path.read_text())
        # Remove IDs that were already shown as resolved (marked ~~) in the previous comment
        prev_text = prev_path.read_text()
        already_resolved = set(re.findall(r"~~.*?`\[(\d+)\]`.*?~~", prev_text, re.DOTALL))
        prev_ids -= already_resolved

resolved_ids = prev_ids - set(active_alerts.keys()) - ignored_rules
short_sha = args.commit[:7] if args.commit else "this commit"

lines = ["## ZAP Baseline Scan — Security Findings\n"]

# Active findings sorted by severity
for alert in sorted(active_alerts.values(), key=lambda a: int(a.get("riskcode", "0")), reverse=True):
    lines.extend(format_alert(alert))

# Resolved findings shown as strikethrough
if resolved_ids:
    lines.append("---")
    lines.append(f"**✅ Resolved in `{short_sha}`** _(findings no longer detected)_\n")
    # We only have the IDs, not the full alert data — show minimal resolved entry
    for pid in sorted(resolved_ids):
        lines.append(f"~~### `[{pid}]`~~\n")

if not active_alerts and not resolved_ids:
    sys.exit(0)

lines.append(
    "_To suppress a false positive: add the rule ID to `.zap/rules.tsv` with action `IGNORE`._"
)

print("\n".join(lines))

# Exit 1 if there are active (non-suppressed) findings so the workflow can hard-fail.
if active_alerts:
    sys.exit(1)
