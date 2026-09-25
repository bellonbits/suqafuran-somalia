from sqlalchemy import inspect, text
from app.db.session import engine

def get_detailed_schema():
    inspector = inspect(engine)
    print("Tables found:", inspector.get_table_names())
    for table_name in inspector.get_table_names():
        print(f"\nTable: {table_name}")
        for column in inspector.get_columns(table_name):
            print(f"  - {column['name']}: {column['type']}")
            
    # Check enum values
    with engine.connect() as connection:
        try:
            result = connection.execute(text("SELECT n.nspname as schema, t.typname as type, e.enumlabel as value FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'meetingresponse'"))
            print("\nEnum 'meetingresponse' values:")
            for row in result:
                print(f"  - {row.value}")
        except Exception as e:
            print(f"\nCould not fetch enum values: {e}")

if __name__ == "__main__":
    get_detailed_schema()
