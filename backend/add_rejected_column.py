import psycopg2
import os

def load_env(env_path):
    env = {}
    try:
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, val = line.strip().split('=', 1)
                    env[key] = val
    except:
        pass
    return env

def main():
    # Try multiple paths for .env
    env = load_env('.env') 
    if not env:
        env = load_env('backend/.env')
    if not env:
        env = load_env('../.env')

    # Defaults
    host = env.get("POSTGRES_SERVER", "localhost")
    user = env.get("POSTGRES_USER", "postgres")
    password = env.get("POSTGRES_PASSWORD", "postgres")
    db = env.get("POSTGRES_DB", "suqafuran")
    port = env.get("POSTGRES_PORT", "5432")
    
    conn_str = f"postgresql://{user}:{password}@{host}:{port}/{db}"
    print(f"Connecting to DB...")
    
    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        print("Executing ALTER TABLE mobiletransaction ADD COLUMN is_rejected...")
        cur.execute("ALTER TABLE mobiletransaction ADD COLUMN IF NOT EXISTS is_rejected BOOLEAN DEFAULT FALSE")
        conn.commit()
        print("Success! Schema updated.")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
