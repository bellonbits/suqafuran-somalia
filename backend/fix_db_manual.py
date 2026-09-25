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

    # Defaults from config.py
    host = env.get("POSTGRES_SERVER", "localhost")
    user = env.get("POSTGRES_USER", "postgres")
    password = env.get("POSTGRES_PASSWORD", "postgres") # common default
    db = env.get("POSTGRES_DB", "suqafuran") # common default
    port = env.get("POSTGRES_PORT", "5432")
    
    print(f"Connecting to DB (User: {user}, DB: {db})...")
    
    try:
        conn = psycopg2.connect(
            host=host,
            database=db,
            user=user,
            password=password,
            port=port
        )
        cur = conn.cursor()
        print("Executing ALTER TABLE mobiletransaction ADD COLUMN currency...")
        cur.execute("ALTER TABLE mobiletransaction ADD COLUMN IF NOT EXISTS currency VARCHAR DEFAULT 'USD'")
        conn.commit()
        print("Success! Schema updated.")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
        # If password fails, maybe try 'admin'? Or ask user.

if __name__ == "__main__":
    main()
