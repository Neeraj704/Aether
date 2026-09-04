import asyncio
import os
import json
import asyncpg

def _sanitize_dict_in_place(obj) -> bool:
    """
    Recursively scans dicts and lists, stripping any 'apiKey' keys found in objects.
    Returns True if any key was stripped.
    """
    modified = False
    if isinstance(obj, dict):
        if "apiKey" in obj:
            del obj["apiKey"]
            modified = True
        for k, v in list(obj.items()):
            if isinstance(v, (dict, list)):
                if _sanitize_dict_in_place(v):
                    modified = True
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, (dict, list)):
                if _sanitize_dict_in_place(item):
                    modified = True
    return modified

async def purge_embedded_api_keys():
    user = os.getenv("POSTGRES_USER", "postgres.gxbqhhlaevnjtmmtmrox")
    password = os.getenv("POSTGRES_PASSWORD", "Anushka@704")
    host = os.getenv("POSTGRES_HOST", "aws-0-ap-south-1.pooler.supabase.com")
    port = int(os.getenv("POSTGRES_PORT", 6543))
    database = os.getenv("POSTGRES_DB", "postgres")

    print(f"Connecting to database at {host}:{port}/{database}...")
    conn = await asyncpg.connect(
        user=user,
        password=password,
        host=host,
        port=port,
        database=database,
    )

    targets = [
        ("bots", "id", "graph"),
        ("bot_versions", "id", "graph"),
        ("presets", "id", "graph"),
        ("preset_versions", "id", "graph"),
        ("marketplace_listings", "id", "graph"),
        ("trades", "id", "execution_flow"),
        ("live_trades", "id", "execution_flow"),
    ]

    summary = {}

    for table, id_col, json_col in targets:
        # Check if table exists
        table_exists = await conn.fetchval(
            """
            select exists (
                select 1 from information_schema.tables 
                where table_schema = 'public' and table_name = $1
            )
            """,
            table,
        )
        if not table_exists:
            summary[table] = "Table does not exist (skipped)"
            continue

        rows = await conn.fetch(f"select {id_col}, {json_col} from public.{table} where {json_col} is not null")
        modified_count = 0

        for r in rows:
            row_id = r[id_col]
            val = r[json_col]
            if isinstance(val, str):
                try:
                    data = json.loads(val)
                except Exception:
                    continue
            else:
                data = json.loads(json.dumps(val))

            if _sanitize_dict_in_place(data):
                await conn.execute(
                    f"update public.{table} set {json_col} = $1::jsonb where {id_col} = $2",
                    json.dumps(data),
                    row_id,
                )
                modified_count += 1

        summary[table] = f"{modified_count} rows modified (scanned {len(rows)})"

    await conn.close()

    print("\n--- Purge Embedded API Keys Summary ---")
    for tbl, res in summary.items():
        print(f"  • {tbl}: {res}")
    print("----------------------------------------\n")

if __name__ == "__main__":
    asyncio.run(purge_embedded_api_keys())
