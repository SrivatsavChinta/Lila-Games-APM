#!/usr/bin/env python3
"""
Convert parquet telemetry files to JSON for frontend consumption.

Usage:
    python convert_to_json.py --input data/player_data/February_10/file.nakama-0 --output output.json
    python convert_to_json.py --input-dir data/player_data/February_10 --output-dir json_output
"""

import json
import argparse
import sys
from pathlib import Path
from typing import Optional

import pandas as pd

from data_loader import (
    load_parquet_file,
    process_telemetry_file,
    MAP_CONFIGS,
    world_to_pixel,
    is_bot,
    decode_event,
)


def convert_file_to_json(
    input_path: Path,
    output_path: Path,
    map_name: Optional[str] = None,
) -> dict:
    """
    Convert a single parquet file to JSON format.

    Args:
        input_path: Path to .nakama-0 file
        output_path: Path to output JSON file
        map_name: Optional map name to force specific map config

    Returns:
        Statistics dict with row counts
    """
    # Load and process the file
    df = load_parquet_file(input_path)

    # Get map config from data or use provided
    if map_name is None and "map_id" in df.columns:
        map_name = df["map_id"].iloc[0]

    map_config = MAP_CONFIGS.get(map_name) if map_name else None

    # Process with coordinate transformation if we have a map config
    if map_config and "x" in df.columns and "z" in df.columns:
        df = process_telemetry_file(input_path, map_config)

    # Convert timestamps from microseconds to milliseconds
    if "ts" in df.columns:
        df["timestamp_ms"] = df["ts"] / 1000

    # Ensure is_bot column exists
    if "is_bot" not in df.columns and "user_id" in df.columns:
        df["is_bot"] = df["user_id"].apply(is_bot)

    # Select and rename columns for frontend
    column_mapping = {
        "user_id": "player_id",
        "match_id": "match_id",
        "map_id": "map_id",
        "x": "x",
        "z": "z",
        "event": "event_type",
        "ts": "timestamp_us",
        "timestamp_ms": "timestamp",
        "is_bot": "is_bot",
    }

    # Only include columns that exist
    available_cols = {k: v for k, v in column_mapping.items() if k in df.columns}
    output_df = df[list(available_cols.keys())].copy()
    output_df.columns = list(available_cols.values())

    # Add pixel coordinates if available
    if "pixel_x" in df.columns:
        output_df["pixel_x"] = df["pixel_x"]
        output_df["pixel_y"] = df["pixel_y"]

    # Convert to records
    records = output_df.to_dict(orient="records")

    # Build output structure
    output = {
        "source_file": str(input_path),
        "map_id": map_name,
        "total_events": len(records),
        "bot_count": int(df["is_bot"].sum()) if "is_bot" in df else 0,
        "human_count": int((~df["is_bot"]).sum()) if "is_bot" in df else 0,
        "events": records,
    }

    # Write JSON
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    return {
        "input": str(input_path),
        "output": str(output_path),
        "events": len(records),
        "bots": output["bot_count"],
        "humans": output["human_count"],
    }


def convert_directory(
    input_dir: Path,
    output_dir: Path,
    limit: Optional[int] = None,
) -> list[dict]:
    """
    Convert all .nakama-0 files in a directory to JSON.

    Args:
        input_dir: Directory containing .nakama-0 files
        output_dir: Directory to write JSON files
        limit: Optional limit on number of files to process

    Returns:
        List of statistics for each file
    """
    input_files = sorted(input_dir.glob("*.nakama-0"))

    if limit:
        input_files = input_files[:limit]

    results = []
    for i, input_file in enumerate(input_files, 1):
        output_file = output_dir / f"{input_file.stem}.json"
        try:
            stats = convert_file_to_json(input_file, output_file)
            results.append(stats)
            print(f"[{i}/{len(input_files)}] Converted: {input_file.name}")
        except Exception as e:
            print(f"[{i}/{len(input_files)}] Error: {input_file.name} - {e}")

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Convert LILA BLACK telemetry files to JSON"
    )
    parser.add_argument(
        "--input",
        type=Path,
        help="Single input file (.nakama-0)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Single output file (.json)",
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        help="Input directory containing .nakama-0 files",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Output directory for JSON files",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of files to process (for testing)",
    )
    parser.add_argument(
        "--map",
        help="Force specific map (AmbroseValley, GrandRift, Lockdown)",
    )

    args = parser.parse_args()

    if args.input:
        # Single file mode
        if not args.output:
            args.output = args.input.with_suffix(".json")
        stats = convert_file_to_json(args.input, args.output, args.map)
        print(f"\nConverted: {stats['input']}")
        print(f"Output: {stats['output']}")
        print(f"Events: {stats['events']}")
        print(f"Bots: {stats['bots']}, Humans: {stats['humans']}")

    elif args.input_dir:
        # Directory mode
        if not args.output_dir:
            args.output_dir = args.input_dir.parent / f"{args.input_dir.name}_json"
        results = convert_directory(args.input_dir, args.output_dir, args.limit)
        print(f"\n{'='*60}")
        print(f"Converted {len(results)} files")
        print(f"Output directory: {args.output_dir}")
        total_events = sum(r["events"] for r in results)
        total_bots = sum(r["bots"] for r in results)
        total_humans = sum(r["humans"] for r in results)
        print(f"Total events: {total_events}")
        print(f"Total bots: {total_bots}, humans: {total_humans}")

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
