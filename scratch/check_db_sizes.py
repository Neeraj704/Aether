import asyncio
import asyncpg

async def main():
    user = "postgres.gxbqhhlaevnjtmmtmrox"
    password = "Anushka@704"
    host = "aws-0-ap-south-1.pooler.supabase.com"
    port = 6543
    database = "postgres"

    try:
        conn = await asyncpg.connect(
            user=user,
            password=password,
            host=host,
            port=port,
            database=database,
            statement_cache_size=0,
        )

        query = """
        SELECT
            c.relname AS table_name,
            pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
            pg_total_relation_size(c.oid) AS total_bytes,
            s.n_live_tup AS estimated_rows
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
        ORDER BY total_bytes DESC;
        """
        rows = await conn.fetch(query)
        print(f"{'Table Name':<30} | {'Total Size':<12} | {'Est. Rows':<12}")
        print("-" * 60)
        for r in rows:
            print(f"{r['table_name']:<30} | {r['total_size']:<12} | {r['estimated_rows']}")

        # Also check all schemas (e.g. pg_toast, auth, etc.)
        schema_query = """
        SELECT
            n.nspname AS schema_name,
            pg_size_pretty(SUM(pg_total_relation_size(c.oid))::bigint) AS total_size
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        GROUP BY n.nspname
        ORDER BY SUM(pg_total_relation_size(c.oid)) DESC;
        """
        s_rows = await conn.fetch(schema_query)
        print("\n--- Schemas Summary ---")
        for sr in s_rows:
            print(f"{sr['schema_name']:<20} | {sr['total_size']}")

        await conn.close()
    except Exception as e:
        print(f"Error checking db sizes: {e}")

if __name__ == "__main__":
    asyncio.run(main())
