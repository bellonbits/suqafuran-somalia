from sqlalchemy import text
from sqlmodel import SQLModel
from app.db.session import engine
# Import the EmailLog model so it registers in SQLModel metadata
from app.models.email_log import EmailLog

def main():
    print("Migrating Database: ensuring emaillog table exists with all tracking columns...")
    
    # Let SQLModel automatically build the table using the correct DB dialect (SERIAL in Postgres)
    try:
        print("Running SQLModel.metadata.create_all...")
        SQLModel.metadata.create_all(engine)
        print("Table 'emaillog' successfully created or verified.")
    except Exception as e:
        print(f"Metadata creation failed, falling back to manual checking: {e}")

    with engine.connect() as conn:
        print("Ensuring columns exist (for Postgres or SQLite schema migrations)...")
        columns = [
            ("user_id", "INTEGER"),
            ("status", "VARCHAR(50)"),
            ("tracking_token", "VARCHAR(255)"),
            ("opened_at", "TIMESTAMP"),
            ("clicked_at", "TIMESTAMP"),
            ("failed_reason", "TEXT"),
            ("provider_used", "VARCHAR(50)"),
            ("campaign_id", "VARCHAR(100)"),
            ("metadata_json", "TEXT")
        ]
        
        for col_name, col_type in columns:
            try:
                print(f"Adding '{col_name}' ({col_type}) to emaillog...")
                # Note: Table name in SQLModel matches table=True class lowercased: "emaillog"
                conn.execute(text(f"ALTER TABLE emaillog ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                print(f"Successfully added column '{col_name}'.")
            except Exception as ex:
                # Column likely already exists
                print(f"Column '{col_name}' might already exist: {ex}")
                
        print("Successfully completed database validation and migrations.")

if __name__ == "__main__":
    main()
