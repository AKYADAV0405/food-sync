import sys
import os

# Ensure backend directory is in python path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

# Re-export app for root uvicorn main:app invocation
try:
    from backend.main import app
except (ModuleNotFoundError, ImportError):
    import importlib
    _mod = importlib.import_module("main")
    app = _mod.app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
