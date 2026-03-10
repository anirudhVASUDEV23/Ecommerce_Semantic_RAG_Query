import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv(".env")

async def main():
    db_url = os.environ.get("NEON_DATABASE_URL")
    print("Connecting to:", db_url)
    try:
        conn = await asyncpg.connect(db_url)
        print("Connected successfully")
        await conn.close()
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
