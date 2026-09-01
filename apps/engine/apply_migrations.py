import asyncio
import os
import asyncpg

async def apply_migrations_asyncpg():
    # Parse connection string or use direct credentials
    # postgres.gxbqhhlaevnjtmmtmrox:Anushka@704@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
    user = "postgres.gxbqhhlaevnjtmmtmrox"
    password = "Anushka@704"
    host = "aws-0-ap-south-1.pooler.supabase.com"
    port = 6543
    database = "postgres"

    print(f"Connecting to Supabase at {host}:{port}/{database}...")
    conn = await asyncpg.connect(
        user=user,
        password=password,
        host=host,
        port=port,
        database=database,
    )

    migrations_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../supabase/migrations"))
    migration_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith(".sql")])

    for fname in migration_files:
        fpath = os.path.join(migrations_dir, fname)
        print(f"\n--- Applying {fname} ---")
        with open(fpath, "r") as f:
            sql_content = f.read()

        try:
            await conn.execute(sql_content)
            print(f"✓ Successfully applied {fname}")
        except Exception as e:
            print(f"Error on {fname}: {e}")

    await conn.close()
    print("\n✓ All migrations executed against Supabase database!")

if __name__ == "__main__":
    asyncio.run(apply_migrations_asyncpg())
