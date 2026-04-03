"""Set up MongoDB indexes and run quick checks after import."""

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

    # Helpful indexes
    indexes = [
        # Article + date lookups
        ([("article", ASCENDING), ("date", ASCENDING)], "article_date"),

        # Project filtering
        ([("project", ASCENDING), ("date", ASCENDING)], "project_date"),

        # Access filtering
        ([("access", ASCENDING), ("date", ASCENDING)], "access_date"),

        # Time grouping
        ([("year", ASCENDING), ("month", ASCENDING)], "year_month"),
        ([("date", ASCENDING)], "date"),

        # Popularity ranking
        ([("views", DESCENDING)], "views_desc"),

        # Common dashboard filter + sort
        ([("project", ASCENDING), ("access", ASCENDING),
          ("date", ASCENDING), ("views", DESCENDING)], "project_access_date_views"),
    ]

    # Build article_search collection (one doc per unique article+project, used for fast text search)
    search_col = db["article_search"]
    existing = search_col.estimated_document_count()
    if existing == 0:
        print("\nBuilding article_search collection (one-time, ~30 s)...")
        pipeline = [
            {"$group": {
                "_id": {"article": "$article", "project": "$project"},
                "total_views": {"$sum": "$views"},
            }},
            {"$project": {
                "_id": 0,
                "article": "$_id.article",
                "project": "$_id.project",
                "total_views": 1,
                "article_words": {
                    "$replaceAll": {"input": "$_id.article", "find": "_", "replacement": " "}
                },
            }},
            {"$out": "article_search"},
        ]
        col.aggregate(pipeline, allowDiskUse=True)
        print(f"  ✓ article_search ({search_col.estimated_document_count():,} docs)")
    else:
        print(f"\narticle_search already built ({existing:,} docs), skipping.")

    print("Creating indexes on article_search...")
    try:
        search_col.create_index(
            [("article_words", "text")], name="article_words_text", default_language="none"
        )
        print("  ✓ article_words_text")
    except OperationFailure as e:
        print(f"  ✗ article_words_text: {e}")
    try:
        search_col.create_index(
            [("project", ASCENDING), ("total_views", DESCENDING)], name="project_views"
        )
        print("  ✓ project_views")
    except OperationFailure as e:
        print(f"  ✗ project_views: {e}")

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

    # 1) One article over time
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

    # 3) Daily totals across pages
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
