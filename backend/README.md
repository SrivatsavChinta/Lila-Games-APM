# Backend Utilities (Optional)

This directory contains optional Python utilities for preprocessing telemetry data.

## When to Use

The frontend handles most use cases browser-side. Use Python preprocessing when:

1. **Parquet files are >500MB** - Browser memory limitations
2. **Complex aggregations needed** - Heatmap pre-computation, statistics
3. **Data transformation** - Converting from proprietary formats to standard schema

## Scripts

### `parquet_to_arrow.py`

Converts large parquet files to smaller Arrow IPC format for browser loading.

```bash
python parquet_to_arrow.py input.parquet output.arrow
```

### `generate_heatmap.py`

Pre-computes heatmap data from events.

```bash
python generate_heatmap.py events.parquet heatmap.json
```

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install pyarrow pandas numpy
```

## Note

These utilities are optional. The frontend can directly load parquet files
for typical data sizes (<100MB).
