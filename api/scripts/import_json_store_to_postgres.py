import argparse
import json
from pathlib import Path

import psycopg


def main() -> None:
    parser = argparse.ArgumentParser(description="Import a ProbeMate JSON store into PostgreSQL.")
    parser.add_argument("--database-url", required=True)
    parser.add_argument("--json-store", default="data/dev-store.json")
    args = parser.parse_args()

    json_path = Path(args.json_store)
    payload = json.loads(json_path.read_text(encoding="utf-8"))
    with psycopg.connect(args.database_url) as conn:
        conn.execute(
            """
            create table if not exists probemate_store (
                id text primary key,
                payload jsonb not null,
                updated_at timestamptz not null default now()
            )
            """
        )
        conn.execute(
            """
            insert into probemate_store (id, payload, updated_at)
            values ('default', %s::jsonb, now())
            on conflict (id) do update set payload = excluded.payload, updated_at = now()
            """,
            (json.dumps(payload, ensure_ascii=False),),
        )


if __name__ == "__main__":
    main()
