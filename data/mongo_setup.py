"""Post-import MongoDB setup for the traffic dataset.

Creates practical indexes, prints collection stats, and runs a few sample queries.
"""

from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import OperationFailure
import pprint

MONGO_URI = "mongodb://localhost:27017/"
DB_NAME   = "wikipedia_traffic"
COL_NAME  = "pageviews"


def main():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    col = db[COL_NAME]

    print(f"Connected. Collection: {DB_NAME}.{COL_NAME}")
    print(f"Document count: {col.estimated_document_count():,}\n")

    # Indexes
    indexes = [
        # Main lookup pattern: article over time
        ([("article", ASCENDING), ("date", ASCENDING)], "article_date"),

        # Project-level filtering
        ([("project", ASCENDING), ("date", ASCENDING)], "project_date"),

        # Access-level filtering
        ([("access", ASCENDING), ("date", ASCENDING)], "access_date"),

        # Time-based grouping
        ([("year", ASCENDING), ("month", ASCENDING)], "year_month"),
        ([("date", ASCENDING)], "date"),

        # Ranking by popularity
        ([("views", DESCENDING)], "views_desc"),

        # Broad dashboard filter + sort
        ([("project", ASCENDING), ("access", ASCENDING),
          ("date", ASCENDING), ("views", DESCENDING)], "project_access_date_views"),
    ]

    print("Creating indexes...")
    for keys, name in indexes:
        try:
            col.create_index(keys, name=name, background=True)
            print(f"  ✓ {name}")
        except OperationFailure as e:
            print(f"  ✗ {name}: {e}")

    # Collection stats
    print("\n── Collection Stats ──")
    stats = db.command("collstats", COL_NAME)
    print(f"  Documents : {stats['count']:,}")
    print(f"  Size      : {stats['size'] / 1e9:.2f} GB")
    print(f"  Indexes   : {stats['nindexes']}")

    # Sample queries
    print("\n── Sample Query Results ──")

    # 1) Daily views for one article
    print("\n1. Daily views for '2NE1' (en.wikipedia, desktop, 2016):")
    results = list(col.find(
        {"article": {"$regex": "2NE1"}, "project": "en.wikipedia.org",
         "access": "desktop", "year": 2016},
        {"_id": 0, "date": 1, "views": 1}
    ).sort("date", ASCENDING).limit(5))
    pprint.pprint(results)

    # 2) Top pages by total views
    print("\n2. Top 5 pages by total views (all time):")
    pipeline = [
        {"$group": {"_id": "$article", "total_views": {"$sum": "$views"}}},
        {"$sort": {"total_views": -1}},
        {"$limit": 5}
    ]
    pprint.pprint(list(col.aggregate(pipeline)))

    # 3) Daily totals across all pages
    print("\n3. Total views per day (first 5 days):")
    pipeline = [
        {"$group": {"_id": "$date", "total_views": {"$sum": "$views"}}},
        {"$sort": {"_id": ASCENDING}},
        {"$limit": 5}
    ]
    pprint.pprint(list(col.aggregate(pipeline)))

    # 4) Total views by project
    print("\n4. Total views by project:")
    pipeline = [
        {"$group": {"_id": "$project", "total_views": {"$sum": "$views"}}},
        {"$sort": {"total_views": -1}}
    ]
    pprint.pprint(list(col.aggregate(pipeline)))

    # 5) Total views by access type
    print("\n5. Total views by access type:")
    pipeline = [
        {"$group": {"_id": "$access", "total_views": {"$sum": "$views"}}},
        {"$sort": {"total_views": -1}}
    ]
    pprint.pprint(list(col.aggregate(pipeline)))

    client.close()
    print("\n✓ Setup complete.")


if __name__ == "__main__":
    main()
