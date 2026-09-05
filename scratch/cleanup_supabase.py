import asyncio
import asyncpg
import time

async def main():
    user = "postgres.gxbqhhlaevnjtmmtmrox"
    password = "Anushka@704"
    host = "aws-0-ap-south-1.pooler.supabase.com"
    port = 6543
    database = "postgres"

    print(f"Connecting to Supabase ({host})...")
    conn = await asyncpg.connect(
        user=user,
        password=password,
        host=host,
        port=port,
        database=database,
        statement_cache_size=0,
    )

    print("\n--- 1. Truncating bulky cached data ---")
    
    # 1. Truncate candles
    print("Truncating table 'candles'...")
    await conn.execute("TRUNCATE TABLE candles;")
    print("✓ 'candles' truncated.")

    # 2. Truncate old backtest trades and runs
    print("Truncating tables 'trades', 'equity_points', 'backtest_runs'...")
    await conn.execute("TRUNCATE TABLE trades CASCADE;")
    await conn.execute("TRUNCATE TABLE backtest_runs CASCADE;")
    print("✓ Backtest tables truncated.")

    # 3. Truncate llm call logs
    print("Truncating table 'llm_call_log'...")
    await conn.execute("TRUNCATE TABLE llm_call_log CASCADE;")
    print("✓ 'llm_call_log' truncated.")

    # 4. Truncate credit transactions debug logs if needed (keeping wallets intact!)
    print("Cleaning credit_transactions debug logs...")
    await conn.execute("TRUNCATE TABLE credit_transactions CASCADE;")
    print("✓ 'credit_transactions' truncated.")

    print("\n--- 2. Running VACUUM FULL to reclaim physical disk space ---")
    print("Running VACUUM FULL (this may take 10-30 seconds)...")
    start = time.time()
    await conn.execute("VACUUM FULL;")
    print(f"✓ VACUUM FULL completed in {time.time() - start:.2f}s.")

    print("\n--- 3. Verifying New Table & Database Sizes ---")
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
    print("\n✓ Supabase database cleanup successfully finished!")

if __name__ == "__main__":
    asyncio.run(main())
