from __future__ import annotations

import unittest

from app.modules.repo_ingestion.chunker import chunk_file_content


class ChunkerTests(unittest.TestCase):
    def test_chunk_file_content_splits_large_python_file(self) -> None:
        content = "\n".join(f"def fn_{index}(): return {index}" for index in range(180))
        chunks = chunk_file_content(content, language="python", max_lines=40, overlap_lines=5)
        self.assertGreater(len(chunks), 3)
        self.assertEqual(chunks[0].start_line, 1)
        self.assertGreaterEqual(chunks[-1].end_line, 175)


if __name__ == "__main__":
    unittest.main()
