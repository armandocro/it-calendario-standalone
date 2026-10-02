import os
import sys
from pathlib import Path

if getattr(sys, "frozen", False):
    # --windowed: stdout/stderr pueden ser None
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")
else:
    # calendario/ en path
    ROOT = Path(__file__).resolve().parent.parent
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    # Repo padre (ittool-devhub) en path
    REPO = ROOT.parent
    if str(REPO) not in sys.path:
        sys.path.insert(0, str(REPO))

os.environ.setdefault("PYTHONUTF8", "1")

from cal_app.server import main  # noqa: E402

if __name__ == "__main__":
    main()
