"""Compatibility entrypoint; generated results are written outside the checkout."""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).resolve().parents[2] / "physics-practice-parity/browser/verify-pdfs.py"), run_name="__main__")
