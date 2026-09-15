import sys
import os

# Locate repository root directory
current_dir = os.path.dirname(os.path.abspath(__file__))
base_dir = os.path.abspath(os.path.join(current_dir, "..", "..", ".."))
entri_dir = os.path.join(base_dir, "entri-modern")

if entri_dir not in sys.path:
    sys.path.insert(0, entri_dir)
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from backend.main import app, ensure_initialized

ensure_initialized()
