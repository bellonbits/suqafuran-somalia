from sqlalchemy import text
from sqlmodel import SQLModel
from app.db.session import engine
# Import all models to register them with SQLModel.metadata
import app.models 

def reset_db():
    print("Dropping all tables...")
    with engine.connect() as conn:
        with conn.begin():
            # Drop all tables in the public schema
            conn.execute(text("DROP SCHEMA public CASCADE;"))
            conn.execute(text("CREATE SCHEMA public;"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
    
    print("Creating all tables based on current models...")
    SQLModel.metadata.create_all(engine)
    
    print("Stamping Alembic version to HEAD (8f1e2d3c4b5a)...")
    with engine.connect() as conn:
        with conn.begin():
            conn.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"))
            conn.execute(text("DELETE FROM alembic_version")) # Clear any old versions
            conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('8f1e2d3c4b5a')"))
            
    print("Database reset and stamped successfully!")

if __name__ == "__main__":
    reset_db()
