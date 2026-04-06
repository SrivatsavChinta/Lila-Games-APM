#!/usr/bin/env python3
"""
Data Loader Utility for LILA BLACK Player Journey Visualization

Reads parquet telemetry files and converts world coordinates to minimap pixels.
"""

import pandas as pd
import pyarrow.parquet as pq
import os
import re
from pathlib import Path
from dataclasses import dataclass
from typing import Optional


@dataclass
class MapConfig:
    """Configuration for map coordinate transformation"""
    name: str
    scale: float
    origin_x: float
    origin_z: float
    image_width: int = 1024
    image_height: int = 1024


# Map configurations from Level Design team
MAP_CONFIGS = {
    "AmbroseValley": MapConfig(
        name="AmbroseValley",
        scale=900,
        origin_x=-370,
        origin_z=-473
    ),
    "GrandRift": MapConfig(
        name="GrandRift",
        scale=581,
        origin_x=-290,
        origin_z=-290
    ),
    "Lockdown": MapConfig(
        name="Lockdown",
        scale=1000,
        origin_x=-500,
        origin_z=-500
    ),
}


def is_bot(user_id: str) -> bool:
    """
    Detect if user is a bot based on user_id format.
    Numeric user_id (e.g., "1440") = bot
    UUID format = human
    """
    # Check if user_id is purely numeric
    return bool(re.match(r'^\d+$', str(user_id)))


def decode_event(event_bytes) -> str:
    """Decode event column from bytes to utf-8 string"""
    if isinstance(event_bytes, bytes):
        return event_bytes.decode('utf-8')
    return str(event_bytes)


def world_to_pixel(x: float, z: float, map_config: MapConfig) -> tuple[float, float]:
    """
    Convert world coordinates to minimap pixel coordinates.

    Formula:
        u = (x - origin_x) / scale
        v = (z - origin_z) / scale
        pixel_x = u * 1024
        pixel_y = (1 - v) * 1024  # Y-axis is flipped

    Returns:
        (pixel_x, pixel_y) tuple
    """
    u = (x - map_config.origin_x) / map_config.scale
    v = (z - map_config.origin_z) / map_config.scale
    pixel_x = u * map_config.image_width
    pixel_y = (1 - v) * map_config.image_height
    return (pixel_x, pixel_y)


def load_parquet_file(filepath: str | Path) -> pd.DataFrame:
    """
    Load a parquet file and perform initial processing.

    Args:
        filepath: Path to the parquet file (no .parquet extension needed)

    Returns:
        DataFrame with decoded columns and derived fields
    """
    filepath = Path(filepath)

    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")

    # Read parquet file
    table = pq.read_table(filepath)
    df = table.to_pandas()

    # Decode event column (bytes to utf-8)
    if 'event' in df.columns:
        df['event'] = df['event'].apply(decode_event)

    # Detect bots vs humans based on user_id
    if 'user_id' in df.columns:
        df['is_bot'] = df['user_id'].apply(is_bot)

    return df


def process_telemetry_file(
    filepath: str | Path,
    map_config: Optional[MapConfig] = None
) -> pd.DataFrame:
    """
    Load and process a telemetry file with coordinate transformation.

    Args:
        filepath: Path to the parquet file
        map_config: Optional MapConfig for coordinate transformation

    Returns:
        Processed DataFrame with pixel coordinates
    """
    df = load_parquet_file(filepath)

    # Add pixel coordinates if map config provided
    if map_config and 'x' in df.columns and 'z' in df.columns:
        pixels = df.apply(
            lambda row: world_to_pixel(row['x'], row['z'], map_config),
            axis=1
        )
        df['pixel_x'] = pixels.apply(lambda p: p[0])
        df['pixel_y'] = pixels.apply(lambda p: p[1])

    return df


def preview_file(filepath: str | Path, num_rows: int = 5) -> None:
    """
    Load a file and print a preview of the first N rows.

    Args:
        filepath: Path to the parquet file
        num_rows: Number of rows to display (default: 5)
    """
    print(f"\n{'='*60}")
    print(f"Loading: {filepath}")
    print(f"{'='*60}")

    try:
        df = load_parquet_file(filepath)

        print(f"\nTotal rows: {len(df)}")
        print(f"Columns: {list(df.columns)}")
        print(f"\nFirst {num_rows} rows:")
        print("-" * 60)

        # Select key columns for display
        display_cols = ['user_id', 'event', 'x', 'z', 'is_bot']
        available_cols = [c for c in display_cols if c in df.columns]

        for idx, row in df.head(num_rows).iterrows():
            print(f"\nRow {idx}:")
            for col in available_cols:
                print(f"  {col}: {row[col]}")

        print(f"\n{'='*60}")
        print(f"Bot count: {df['is_bot'].sum() if 'is_bot' in df.columns else 'N/A'}")
        print(f"Human count: {(~df['is_bot']).sum() if 'is_bot' in df.columns else 'N/A'}")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"Error loading file: {e}")
        raise


def find_data_files(data_dir: str | Path = "../data/player_data") -> list[Path]:
    """
    Find all .nakama-0 parquet files in the data directory.

    Args:
        data_dir: Root data directory path

    Returns:
        List of file paths
    """
    data_dir = Path(data_dir)
    files = []

    # Find all .nakama-0 files in date subdirectories
    for date_dir in data_dir.glob("February_*"):
        if date_dir.is_dir():
            files.extend(date_dir.glob("*.nakama-0"))

    return sorted(files)


if __name__ == "__main__":
    # Example usage
    DATA_DIR = Path(__file__).parent.parent / "data" / "player_data"

    # Find all data files
    files = find_data_files(DATA_DIR)

    if files:
        print(f"Found {len(files)} data files")
        print(f"\nPreviewing first file: {files[0].name}")
        preview_file(files[0], num_rows=5)
    else:
        print(f"No .nakama-0 files found in {DATA_DIR}")
        print("\nLooking for files in:")
        for date_dir in DATA_DIR.glob("February_*"):
            if date_dir.is_dir():
                print(f"  {date_dir}")
