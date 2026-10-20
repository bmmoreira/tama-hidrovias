#!/usr/bin/env python3
"""Adds cota_leito_maxima/cota_leito_media to every cross-section point.

Reads each feature's `secoes_transversais/<file>` profile (distance, bed
elevation, tab-separated, "nan" for NoData -- same format CrossSectionModal
parses) and writes two precomputed properties back onto the feature:
cota_leito_maxima (max elevation) and cota_leito_media (mean elevation).

These drive the cross-section circle markers' color/label on the public map
(see crossSectionClusterLayer.ts) -- computed here, once, ahead of time,
rather than at runtime, since the map would otherwise need to fetch all
~500 profile files just to color the points (CrossSectionModal fetches a
profile lazily, only when its own modal opens, by design).

Usage (idempotent -- safe to re-run after adding/replacing points/profiles):
    pipeline/venv/bin/python scripts/compute_cross_section_stats.py
"""
import json
import statistics
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

TARGETS = [
    (
        REPO_ROOT / "assets" / "output_points_water_level.geojson",
        REPO_ROOT / "assets" / "secoes_transversais",
    ),
    (
        REPO_ROOT / "web" / "public" / "geojson" / "output_points_water_level.geojson",
        REPO_ROOT / "web" / "public" / "geojson" / "secoes_transversais",
    ),
]


def profile_stats(path: Path) -> tuple[float, float] | None:
    depths = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        _, depth_str = line.split("\t")
        if depth_str == "nan":
            continue
        depths.append(float(depth_str))
    if not depths:
        return None
    return max(depths), statistics.mean(depths)


def main() -> None:
    for geojson_path, profiles_dir in TARGETS:
        with geojson_path.open() as f:
            data = json.load(f)

        updated = 0
        skipped = []
        for feature in data["features"]:
            props = feature["properties"]
            profile_path = profiles_dir / props["file"]
            if not profile_path.exists():
                skipped.append(props["file"])
                continue
            stats = profile_stats(profile_path)
            if stats is None:
                skipped.append(props["file"])
                continue
            maxima, media = stats
            props["cota_leito_maxima"] = maxima
            props["cota_leito_media"] = media
            updated += 1

        with geojson_path.open("w") as f:
            json.dump(data, f)

        print(f"{geojson_path.relative_to(REPO_ROOT)}: updated {updated}, skipped {len(skipped)}")
        if skipped:
            print(f"  skipped (missing/empty profile): {skipped[:10]}{'...' if len(skipped) > 10 else ''}")


if __name__ == "__main__":
    main()
