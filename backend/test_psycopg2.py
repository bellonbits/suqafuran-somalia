import psycopg2
from app.core.config import settings

def test_psycopg2():
    try:
        # Parse DATABASE_URL
        conn = psycopg2.connect(settings.DATABASE_URL)
        cur = conn.cursor()
        print("Attempting psycopg2 insert...")
        cur.execute("""
            INSERT INTO "user" (
                phone, full_name, email, 
                is_active, is_verified, is_admin,
                verified_level, response_time,
                email_notifications, sms_notifications,
                created_at, updated_at
            ) VALUES (
                '+252610000020', 'Psycopg2 Test', 'psycopg2@example.com',
                true, false, false,
                'guest', 'test',
                true, false,
                NOW(), NOW()
            )
        """)
        conn.commit()
        print("Success!")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_psycopg2()
