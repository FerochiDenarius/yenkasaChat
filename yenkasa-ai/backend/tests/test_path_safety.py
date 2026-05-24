from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.utils.path_safety import build_repo_name
from app.utils.path_safety import ensure_within_roots


class PathSafetyTests(unittest.TestCase):
    def test_ensure_within_roots_accepts_nested_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            nested = root / "repo"
            nested.mkdir()
            resolved = ensure_within_roots(nested, [root])
            self.assertEqual(resolved, nested.resolve())

    def test_build_repo_name_slugifies_values(self) -> None:
        repo_name = build_repo_name("Yenkasa Dev Repo!", Path("/tmp/repo"))
        self.assertEqual(repo_name, "Yenkasa-Dev-Repo")


if __name__ == "__main__":
    unittest.main()
