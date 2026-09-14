import sys
import os

# Base directory setup
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
entri_dir = os.path.join(base_dir, "entri-modern")

if entri_dir not in sys.path:
    sys.path.insert(0, entri_dir)
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)


from backend.main import app, ensure_initialized

# Ensure schemas and database initialization on serverless startup
ensure_initialized()
