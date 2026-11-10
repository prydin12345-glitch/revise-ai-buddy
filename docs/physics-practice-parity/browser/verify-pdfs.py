"""Verify actual offline Physics PDF exports; no backend or network is used.

The browser fixture supplies fixture-manifest.json and pdf-capture-{theme}.json.
Scientific glyphs are checked in extracted PDF text; SVG content is checked in
the DOM captured immediately before real html2canvas rasterisation. Review PNGs
are produced from the standalone PDF, so a reviewer can assess the final render.
"""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile

try:
    import fitz
except ImportError:
    raise SystemExit('Optional PDF verification needs PyMuPDF==1.26.6. Install it in a separate venv; see README.md. Browser exports remain available without this step.')

ROOT = Path(os.environ.get('PHYSICS_ARTIFACT_DIR', str(Path(tempfile.gettempdir()) / 'physics-practice-parity-artifacts'))).resolve()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def load_captures(theme):
    captured = json.loads((ROOT / f"pdf-capture-{theme}.json").read_text())
    return captured["captures"] if isinstance(captured, dict) else captured


def main():
    missing = [name for name in ('pdfinfo', 'pdftotext') if shutil.which(name) is None]
    if missing:
        raise SystemExit('Optional PDF verification needs Poppler commands ' + ', '.join(missing) + '; see README.md. Browser PDF exports remain available without this step.')
    manifest = json.loads((ROOT / "fixture-manifest.json").read_text())
    symbols = manifest.get("unicodeSymbols", list("Ωµ→αβγλθ±×÷∞"))
    symbols = list(symbols)
    question_count = manifest["questionCount"]
    captures_expected = manifest.get("captureCount")
    forbidden = r"PRIVATE[_A-Z0-9]*|ANSWER_KEY_SENTINEL|Correct answer:|Expected answer:|Worked solution:"
    reports = []
    by_theme = {}

    for theme in ("light", "dark"):
        pdf = ROOT / f"physics-{theme}.pdf"
        require(pdf.is_file(), f"Missing exported PDF: {pdf.name}")
        info = subprocess.run(["pdfinfo", str(pdf)], check=True, capture_output=True, text=True).stdout
        pages = int(re.search(r"^Pages:\s+(\d+)", info, re.M)[1])
        text_path = ROOT / f"physics-{theme}.txt"
        subprocess.run(["pdftotext", "-layout", str(pdf), str(text_path)], check=True)
        extracted = text_path.read_text()
        require(pages >= 2, f"{theme}: cover and body pages were not both exported")
        require(not re.search(forbidden, extracted, re.I), f"{theme}: private answer content in PDF text")
        require("\ufffd" not in extracted and "\x00" not in extracted, f"{theme}: damaged Unicode extraction")
        for symbol in symbols:
            require(symbol in extracted, f"{theme}: Unicode glyph absent from PDF text: {symbol!r}")
        for number in range(1, question_count + 1):
            require(re.search(rf"^\s*Question {number}(?:\s|$)", extracted, re.M),
                    f"{theme}: Question {number} heading absent")
        for expected in manifest.get("pdfTextIncludes", []):
            require(expected in extracted, f"{theme}: missing expected PDF text: {expected!r}")
        for rejected in manifest.get("pdfTextExcludes", []):
            require(rejected not in extracted, f"{theme}: forbidden PDF text: {rejected!r}")

        captures = load_captures(theme)
        require(captures, f"{theme}: no real figure rasterisation was observed")
        if captures_expected is not None:
            require(len(captures) == captures_expected,
                    f"{theme}: expected {captures_expected} figure captures, got {len(captures)}")
        for index, capture in enumerate(captures):
            html = capture.get("html", "")
            require(capture.get("hasSvg") or "<svg" in html,
                    f"{theme}: figure capture {index} had no SVG")
            combined = html + capture.get("text", "")
            require(not re.search(forbidden, combined, re.I) and not re.search(r"\bNaN\b|\bundefined\b", combined),
                    f"{theme}: invalid or private figure capture {index}")
        for check in manifest.get("captureAssertions", []):
            capture = captures[check["index"]]
            combined = capture.get("html", "") + "\n" + capture.get("text", "")
            for expected in check.get("includes", []):
                require(expected in combined, f"{theme}: capture {check['index']} missing {expected!r}")
            for rejected in check.get("excludes", []):
                require(rejected not in combined, f"{theme}: capture {check['index']} disclosed {rejected!r}")

        document = fitz.open(pdf)
        fonts = {}
        image_count = 0
        for page in document:
            image_count += len(page.get_images(full=True))
            for font in page.get_fonts(full=True):
                if font[0] in fonts:
                    continue
                font_content = document.extract_font(font[0])
                fonts[font[0]] = {"name": font[3], "type": font[2], "extension": font[1],
                                  "embeddedBytes": len(font_content[3] or b"")}
        require(image_count > 0, f"{theme}: standalone PDF contains no figure image objects")
        require(any(font["embeddedBytes"] > 0 and font["extension"] == "ttf" for font in fonts.values()),
                f"{theme}: no embedded TrueType scientific font found")
        document.close()
        by_theme[theme] = captures
        reports.append({"theme": theme, "pages": pages, "bytes": pdf.stat().st_size,
                        "sha256": sha256(pdf), "questionHeadingsPresent": question_count,
                        "unicodeGlyphsPresent": symbols, "privateAnswerTextAbsent": True,
                        "figureCaptureCount": len(captures), "pdfImageReferences": image_count,
                        "fonts": list(fonts.values())})

    require([c.get("text", "") for c in by_theme["light"]] ==
            [c.get("text", "") for c in by_theme["dark"]],
            "Figure labels differ between light and dark PDF export")

    document = fitz.open(ROOT / "physics-light.pdf")
    page_texts = [page.get_text() for page in document]
    notation_page = max(range(len(document)), key=lambda index: sum(symbol in page_texts[index] for symbol in symbols))
    selected = {"pdf-first-page": 0, "pdf-first-body-page": 1, "pdf-notation-page": notation_page}
    raster_questions = dict(manifest.get("rasterQuestions", {}))
    expected_types = manifest.get("expectedCaptureTypes", [])
    if "ray_diagram" in expected_types:
        raster_questions.setdefault("ray", expected_types.index("ray_diagram") + 1)
    for name, question in raster_questions.items():
        # A figure can move to the following physical page after its stem.
        # Prefer the actual numbered figure caption so review PNGs contain it.
        found = [index for index, text in enumerate(page_texts)
                 if re.search(rf"\bFigure {question}(?:\s|$)", text)]
        if not found:
            found = [index for index, text in enumerate(page_texts)
                     if re.search(rf"\bQuestion {question}(?:\s|$)", text)]
        require(found, f"Cannot locate Question {question} for {name} review raster")
        selected[f"pdf-{name}-page"] = found[0]
    rasters = []
    for name, index in selected.items():
        page = document[index]
        scale = 1600 / max(page.rect.width, page.rect.height)
        output = ROOT / f"{name}.png"
        page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False).save(output)
        rasters.append({"file": output.name, "sha256": sha256(output), "physicalPage": index + 1,
                        "sourcePdf": "physics-light.pdf", "sourcePdfSha256": reports[0]["sha256"]})
    document.close()
    result = {"status": "PASS", "verificationDate": datetime.datetime.now(datetime.timezone.utc).date().isoformat(),
              "pdfs": reports, "figureLabelsEqualAcrossThemes": True, "rasters": rasters,
              "rasterizer": {"name": "MuPDF / PyMuPDF", "version": fitz.VersionBind},
              "limitations": [
                  "PDF figures are raster images: scientific labels and unknowns are checked in the actual SVG capture DOM, with final PDF raster review required.",
                  "Unicode assertions establish extractable glyphs and an embedded font; they do not certify every possible scientific expression or semantic correctness.",
                  "Synthetic offline component exports do not exercise a saved private paper, live generation, backend persistence, or deployment."
              ]}
    (ROOT / "pdf-verification.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"status": "PASS", "pdfs": len(reports), "pages": [report["pages"] for report in reports],
                      "captures": [report["figureCaptureCount"] for report in reports], "unicodeSymbols": symbols}, ensure_ascii=False))


if __name__ == "__main__":
    main()
