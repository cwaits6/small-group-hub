#!/usr/bin/env python3
"""Format ZAP baseline JSON report as a markdown PR comment."""
import json
import re
import sys

RISK_LABEL = {"3": "🔴 High", "2": "🟠 Medium", "1": "🟡 Low", "0": "🔵 Info"}


def strip_html(text: str) -> str:
    """Remove HTML tags and normalise whitespace."""
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


try:
    data = json.load(open("report_json.json"))
except FileNotFoundError:
    print("No ZAP report found.", file=sys.stderr)
    sys.exit(1)

alerts = []
for site in data.get("site", []):
    for alert in site.get("alerts", []):
        alerts.append(alert)

if not alerts:
    sys.exit(0)

alerts.sort(key=lambda a: int(a.get("riskcode", "0")), reverse=True)

lines = ["## ZAP Baseline Scan — Security Findings\n"]
for alert in alerts:
    risk = RISK_LABEL.get(str(alert.get("riskcode", "0")), "Info")
    name = alert["name"]
    plugin_id = alert.get("pluginid", "")
    count = alert.get("count", "?")
    desc = strip_html(alert.get("desc", ""))
    solution = strip_html(alert.get("solution", ""))
    instances = alert.get("instances", [])
    urls = list(dict.fromkeys(i["uri"] for i in instances))

    lines.append(f"### {risk} — {name} `[{plugin_id}]` ({count} instance(s))")
    if desc:
        lines.append(f"{desc}\n")
    for url in urls:
        lines.append(f"- {url}")
    if solution:
        lines.append(f"\n**Remediation:** {solution}")
    lines.append("")

lines.append(
    "_To suppress a false positive: add the rule ID to `.zap/rules.tsv` with action `IGNORE`._"
)

print("\n".join(lines))
