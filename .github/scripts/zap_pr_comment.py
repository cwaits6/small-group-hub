#!/usr/bin/env python3
"""Format ZAP baseline JSON report as a markdown PR comment."""
import json
import re
import sys
from pathlib import Path

RISK_LABEL = {"3": "🔴 High", "2": "🟠 Medium", "1": "🟡 Low", "0": "🔵 Info"}
CONFIDENCE_LABEL = {"4": "Confirmed", "3": "High", "2": "Medium", "1": "Low", "0": "False Positive"}


def strip_html(text: str) -> str:
    """Remove HTML tags and normalise whitespace."""
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def load_ignored_rules() -> set[str]:
    """Read .zap/rules.tsv and return plugin IDs marked IGNORE."""
    ignored = set()
    rules_path = Path(".zap/rules.tsv")
    if not rules_path.exists():
        return ignored
    for line in rules_path.read_text().splitlines():
        line = line.split("#")[0].strip()  # strip comments
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) >= 2 and parts[1].strip() == "IGNORE":
            ignored.add(parts[0].strip())
    return ignored


try:
    data = json.load(open("report_json.json"))
except FileNotFoundError:
    print("No ZAP report found.", file=sys.stderr)
    sys.exit(1)

ignored_rules = load_ignored_rules()

alerts = []
for site in data.get("site", []):
    for alert in site.get("alerts", []):
        if alert.get("pluginid", "") not in ignored_rules:
            alerts.append(alert)

if not alerts:
    sys.exit(0)

alerts.sort(key=lambda a: int(a.get("riskcode", "0")), reverse=True)

lines = ["## ZAP Baseline Scan — Security Findings\n"]
for alert in alerts:
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

lines.append(
    "_To suppress a false positive: add the rule ID to `.zap/rules.tsv` with action `IGNORE`._"
)

print("\n".join(lines))
