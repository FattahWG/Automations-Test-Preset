"""Builds docs/documents/LawakStore_TestPlan.docx from the test case source.

Usage: python scripts/build_test_plan_docx.py
"""
from collections import Counter, defaultdict
from datetime import datetime

from docx_common import BRAND, ROOT, load_source, new_document, para, table

OUT = ROOT.parent / "docs" / "documents" / "LawakStore_TestPlan.docx"


def main():
    src = load_source()
    cases = src["cases"]
    modules = {m["code"]: m["name"] for m in src["modules"]}
    phases = {p["id"]: p["name"] for p in src["phases"]}
    doc = new_document(landscape=False)

    para(doc, "Lawak Store", bold=True, size=12, color=BRAND)
    doc.add_heading("Test Plan", level=0)
    table(doc, ["Item", "Value"], [
        ["Product", "Lawak Store: demo shop with a customer storefront and an admin panel"],
        ["Plan version", f"{src['version']} ({datetime.now():%d %b %Y})"],
        ["Test cases", f"{len(cases)} ({sum(c['layer'] == 'UI' for c in cases)} UI with Playwright, {sum(c['layer'] == 'API' for c in cases)} API with Bruno CLI)"],
        ["Source of truth", "demo/test-cases/source/lawak-store.json. The workbook, catalog and this plan are generated from it."],
    ], widths=[1.6, 5.2])

    doc.add_heading("1. Scope", level=1)
    para(doc, "In scope: sign in, registration, catalog, cart, checkout with mock payment, customer orders, and the admin "
              "panel (dashboard, products, orders, users). Access control is tested at the UI and at the API.")
    para(doc, "Out of scope: real payments, email delivery, performance and load, and browsers other than Microsoft Edge "
              "(Chromium and a mobile viewport are available as optional projects).")

    doc.add_heading("2. Test approach", level=1)
    table(doc, ["Layer", "Tool", "What it checks"], [
        ["UI", "Playwright runner (@playwright/test)", "What a user sees: pages, messages, totals, access rules. One test per case ID, one caseStep per case step, a screenshot per step."],
        ["API", "Bruno CLI (@usebruno/cli)", "Endpoint contracts: status codes and error codes for the business rules."],
        ["Evidence", "Python (python-docx, openpyxl)", "Word evidence per run and the Excel workbook with the latest result of each case."],
    ], widths=[0.8, 2.0, 4.0])

    doc.add_heading("3. Suites", level=1)
    commands = {"smoke": "node scripts/run-suite.js --suite smoke", "regression": "node scripts/run-suite.js --suite regression",
                "full": "node scripts/run-suite.js --suite full"}
    counts = {
        "smoke": sum("smoke" in c["suites"] for c in cases),
        "regression": sum("regression" in c["suites"] for c in cases),
        "full": len(cases),
    }
    table(doc, ["Suite", "Cases", "When", "Command"], [
        [s["name"], counts[s["id"]], s["description"], commands[s["id"]]] for s in src["suites"]
    ], widths=[1.0, 0.6, 2.8, 2.4])
    para(doc, "Every suite can be narrowed by sprint, phase and module, for example "
              "node scripts/run-suite.js --suite regression --sprint 2 --module chk. The test dashboard builds this command.", italic=True)

    doc.add_heading("4. Phases and sprints", level=1)
    by_sprint = defaultdict(Counter)
    for c in cases:
        by_sprint[c["sprint"]][c["module"]] += 1
    table(doc, ["Phase", "Sprint", "Goal", "Modules (cases)"], [
        [phases[sp["phase"]], sp["name"], sp["goal"], ", ".join(f"{modules[m]} ({n})" for m, n in by_sprint[sp["id"]].items())]
        for sp in src["sprints"]
    ], widths=[1.6, 0.8, 2.0, 2.4])

    doc.add_heading("5. Environment and test data", level=1)
    table(doc, ["Item", "Value"], [
        ["Local target", "http://127.0.0.1:4173 (demo/server/server.js). The same backend.js runs in the GitHub Pages build."],
        ["Browser", "Microsoft Edge (installed channel). Optional: Chromium, Pixel 7 viewport."],
        ["Demo accounts", "Admin login@demo.com. Customer customer@demo.com. Disabled budi@demo.com. Passwords are in the README."],
        ["Mock cards", "4242 4242 4242 4242 is approved. 4000 0000 0000 0002 is declined."],
        ["Test data rule", "Tests make their own data with the prefix qa-auto and remove the products they create. Each run starts from the seed data."],
    ], widths=[1.6, 5.2])

    doc.add_heading("6. Entry and exit criteria", level=1)
    para(doc, "Entry: the build starts, the smoke suite passes, and the test cases of the sprint are Ready to test.")
    para(doc, "Exit: every High priority case passes, every failure has a defect or a reason, and the Word evidence and "
              "workbook of the last Full Cycle run are published to the dashboard.")

    doc.add_heading("7. Defects", level=1)
    para(doc, "A failed case is a finding, not a reason to change the expected result. Each failure is reported with the "
              "failed step, the actual result, the layer and owner (Frontend, Backend, Environment, Reference) and the evidence file.")
    table(doc, ["Defect", "Case", "Summary", "Severity", "Priority", "Status"], [
        ["DEF-001", "TC-CHK-006", "Checkout accepts a 4-digit postal code. Rule R-07 needs exactly 5 digits.", "Minor", "Medium", "Open (planted for the demo)"],
    ], widths=[0.8, 1.0, 2.6, 0.8, 0.7, 1.0])

    doc.add_heading("8. Deliverables", level=1)
    for d in ["LawakStore_TestCases.xlsx: every case with steps, expected results and the latest result.",
              "Evidence_<scenario>_RunTestN.docx: per run, status of all cases, failure summary, and every step with its screenshot or API response.",
              "Playwright HTML report, JUnit XML and Bruno HTML report in each local run folder.",
              "Test dashboard on GitHub Pages: suite builder, case list, run history and documents."]:
        doc.add_paragraph(d, style="List Bullet")

    doc.add_heading("9. Traceability", level=1)
    refs = defaultdict(list)
    for c in cases:
        refs[c["refs"].split(" ")[0]].append(c["id"])
    table(doc, ["Requirement", "Test cases"], [[r, ", ".join(ids)] for r, ids in sorted(refs.items())], widths=[1.4, 5.4])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print(f"Test plan: {OUT}")


if __name__ == "__main__":
    main()
