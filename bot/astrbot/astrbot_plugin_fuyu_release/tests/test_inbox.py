import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from inbox import archive, caption, latest_release, read_releases


def drop(folder: Path, name: str, manifest: dict, age: float = 10, image: bool = True) -> None:
    then = time.time() - age
    if image:
        png = folder / f"{name}.png"
        png.write_bytes(b"png")
        os.utime(png, (then, then))
    path = folder / f"{name}.json"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    os.utime(path, (then, then))


class ReadReleasesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_reads_a_settled_upload(self):
        drop(self.folder, "a", {"version": "v0.3.12-beta.3", "image": "a.png"})
        [release] = read_releases(self.folder)
        self.assertEqual(release.version, "0.3.12-beta.3")
        self.assertEqual(release.channel, "beta")
        self.assertEqual(release.url, "https://github.com/TixXin/fuyu/releases/tag/v0.3.12-beta.3")
        self.assertIn("测试版", caption(release))

    def test_waits_for_files_still_being_uploaded(self):
        drop(self.folder, "a", {"version": "0.3.12", "image": "a.png"}, age=0)
        self.assertEqual(read_releases(self.folder), [])

    def test_skips_a_manifest_whose_image_has_not_arrived(self):
        drop(self.folder, "a", {"version": "0.3.12", "image": "a.png"}, image=False)
        self.assertEqual(read_releases(self.folder), [])

    def test_never_reads_an_image_outside_the_folder(self):
        outside = self.folder.parent / "outside.png"
        drop(self.folder, "a", {"version": "0.3.12", "image": "../outside.png"})
        self.assertEqual(read_releases(self.folder), [])
        self.assertFalse(outside.exists())

    def test_skips_broken_manifests(self):
        (self.folder / "b.json").write_text("{", encoding="utf-8")
        drop(self.folder, "a", {"version": "0.3.12", "image": "a.png"})
        self.assertEqual([release.version for release in read_releases(self.folder)], ["0.3.12"])

    def test_archive_moves_both_files_and_latest_finds_them(self):
        drop(self.folder, "a", {"version": "0.3.12", "image": "a.png"})
        [release] = read_releases(self.folder)
        sent = self.folder / "sent"
        archive(release, sent)
        self.assertEqual(read_releases(self.folder), [])
        latest = latest_release(sent)
        self.assertEqual(latest.version, "0.3.12")
        self.assertEqual(latest.channel, "stable")


if __name__ == "__main__":
    unittest.main()
