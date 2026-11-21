from __future__ import annotations

import json
import shutil
import time
from dataclasses import dataclass
from pathlib import Path

SETTLE_SECONDS = 3
RELEASES_URL = "https://github.com/TixXin/fuyu/releases/tag/v"


@dataclass
class Release:
    manifest: Path
    image: Path
    version: str
    channel: str
    url: str


def read_releases(folder: Path, now: float | None = None) -> list[Release]:
    now = time.time() if now is None else now
    if not folder.is_dir():
        return []
    found = []
    manifests = sorted(folder.glob("*.json"), key=lambda path: path.stat().st_mtime)
    for manifest in manifests:
        try:
            if now - manifest.stat().st_mtime < SETTLE_SECONDS:
                continue
            data = json.loads(manifest.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(data, dict):
            continue
        version = str(data.get("version") or "").strip().removeprefix("v")
        image = folder / Path(str(data.get("image") or "")).name
        if not version or image == folder or not image.is_file():
            continue
        if now - image.stat().st_mtime < SETTLE_SECONDS:
            continue
        channel = str(data.get("channel") or ("beta" if "-" in version else "stable"))
        url = str(data.get("url") or f"{RELEASES_URL}{version}")
        found.append(Release(manifest, image, version, channel, url))
    return found


def latest_release(folder: Path) -> Release | None:
    releases = read_releases(folder, now=float("inf"))
    return releases[-1] if releases else None


def caption(release: Release) -> str:
    kind = "测试版" if release.channel == "beta" else "正式版"
    return f"浮屿 v{release.version}（{kind}）发布了\n{release.url}"


def archive(release: Release, folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for path in (release.image, release.manifest):
        shutil.move(str(path), str(folder / path.name))
