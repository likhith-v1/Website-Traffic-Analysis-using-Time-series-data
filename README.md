# Website Traffic Analysis Using Time Series Data

This project transforms Wikipedia traffic data into a format that is easy to
import into MongoDB and analyze with Polars.

## Files

- `data/transform_to_mongo.py`: Converts wide CSV pageview data to long JSONL.
- `data/mongo_setup.py`: Creates indexes and runs sample MongoDB queries.
- `data/data_loader_mongo.py`: Loads and preprocesses data with Polars.

## Quick start

```bash
uv pip install polars tqdm pymongo
python3 data/transform_to_mongo.py
python3 data/mongo_setup.py
```
