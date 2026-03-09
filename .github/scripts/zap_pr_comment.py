#!/usr/bin/env python3
"""Format ZAP baseline JSON report as a markdown PR comment."""
import json
import re
import sys

RISK_LABEL = {"3": "🔴 High", "2": "🟠 Medium", "1": "🟡 Low", "0": "🔵 Info"}
CONFIDENCE_LABEL = {"4": "Confirmed", "3": "High", "2": "Medium", "1": "Low", "0": "False Positive"}


def strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def load_ignored_rules() -> set[str]:
    ignored = set()
    try:
        for line in open(".zap/rules.tsv").read().splitlines():
            line = line.split("#")[0].strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 2 and parts[1].strip() == "IGNORE":
                ignored.add(parts[0].strip())
    except FileNotFoundError:
        pass
    return ignored


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


try:
    data = json.load(open("report_json.json"))
except FileNotFoundError:
    print("No ZAP report found.", file=sys.stderr)
    sys.exit(1)

ignored_rules = load_ignored_rules()

active_alerts = {}
for site in data.get("site", []):
    for alert in site.get("alerts", []):
        pid = alert.get("pluginid", "")
        if pid not in ignored_rules:
            active_alerts[pid] = alert

if not active_alerts:
    sys.exit(0)

lines = ["## ZAP Baseline Scan — Security Findings\n"]
for alert in sorted(active_alerts.values(), key=lambda a: int(a.get("riskcode", "0")), reverse=True):
    lines.extend(format_alert(alert))

lines.append("_To suppress a false positive: add the rule ID to `.zap/rules.tsv` with action `IGNORE`._")
print("\n".join(lines))
sys.exit(1)
