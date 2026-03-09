#!/usr/bin/env python3
"""Format ZAP baseline JSON report as a markdown PR comment."""
import json
import sys

RISK_LABEL = {"3": "🔴 High", "2": "🟠 Medium", "1": "🟡 Low", "0": "🔵 Info"}

try:
    data = json.load(open("zap-report.json"))
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
    instances = alert.get("instances", [])
    urls = list(dict.fromkeys(i["uri"] for i in instances))[:3]

    lines.append(f"### {risk} — {name} `[{plugin_id}]` ({count} instance(s))")
    for url in urls:
        lines.append(f"- {url}")
    if len(instances) > 3:
        lines.append(f"- _…and {len(instances) - 3} more_")
    lines.append("")

lines.append(
    "_To suppress a false positive: add the rule ID to `.zap/rules.tsv` with action `IGNORE`._"
)

print("\n".join(lines))
