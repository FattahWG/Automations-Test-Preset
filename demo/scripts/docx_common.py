"""Shared helpers for the Word documents (python-docx)."""
import io
import json
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
BRAND = RGBColor(0xC2, 0x41, 0x0C)
STATUS_FILL = {"Pass": "DCFCE7", "Fail": "FEE2E2", "Skipped": "FEF3C7", "Not run": "F1F5F9"}


def load_source():
    return json.loads((ROOT / "test-cases" / "source" / "lawak-store.json").read_text(encoding="utf-8"))


def new_document(landscape=True):
    doc = Document()
    sec = doc.sections[0]
    if landscape:
        sec.orientation = WD_ORIENT.LANDSCAPE
        sec.page_width, sec.page_height = sec.page_height, sec.page_width
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(sec, side, Inches(0.7))
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10)
    for name, size in (("Heading 1", 18), ("Heading 2", 14), ("Heading 3", 12)):
        doc.styles[name].font.color.rgb = BRAND if name == "Heading 1" else RGBColor(0x1D, 0x1B, 0x16)
        doc.styles[name].font.size = Pt(size)
    return doc


def shade(cell, hex_fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tc_pr.append(shd)


def keep_row_together(row):
    tr_pr = row._tr.get_or_add_trPr()
    cant = OxmlElement("w:cantSplit")
    cant.set(qn("w:val"), "true")
    tr_pr.append(cant)


def repeat_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    hdr = OxmlElement("w:tblHeader")
    hdr.set(qn("w:val"), "true")
    tr_pr.append(hdr)


def table(doc, headers, rows, widths=None, status_col=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = ""
        run = cell.paragraphs[0].add_run(h)
        run.bold = True
        run.font.size = Pt(9)
        shade(cell, "F0EDE6")
    repeat_header(t.rows[0])
    for r in rows:
        row = t.add_row()
        keep_row_together(row)
        for i, v in enumerate(r):
            cell = row.cells[i]
            cell.text = ""
            run = cell.paragraphs[0].add_run("" if v is None else str(v))
            run.font.size = Pt(9)
            if status_col is not None and i == status_col and str(v) in STATUS_FILL:
                shade(cell, STATUS_FILL[str(v)])
                run.bold = True
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Inches(w)
    return t


def picture(doc, path, height_in=3.1):
    """Adds a screenshot with a uniform height. Large PNGs are shrunk to JPEG to keep the file small."""
    try:
        from PIL import Image
        with Image.open(path) as im:
            im = im.convert("RGB")
            max_w = 1100
            if im.width > max_w:
                im = im.resize((max_w, int(im.height * max_w / im.width)))
            # Cap very tall full-page shots so one image never fills more than a page.
            if im.height > 1400:
                im = im.crop((0, 0, im.width, 1400))
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=72, optimize=True)
            buf.seek(0)
            doc.add_picture(buf, height=Inches(height_in))
    except ImportError:
        doc.add_picture(str(path), height=Inches(height_in))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.LEFT


def para(doc, text, bold=False, italic=False, size=None, color=None):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    if size:
        run.font.size = Pt(size)
    if color:
        run.font.color.rgb = color
    return p


def mono(doc, text, size=8):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = "Consolas"
    run.font.size = Pt(size)
    return p
