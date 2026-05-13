import psycopg2
from psycopg2.extras import RealDictCursor
import time

# --- Cấu hình PostgreSQL (Khớp với mqtt_to_pg.py) ---
DB_HOST = "localhost"
DB_NAME = "smart_parking"
DB_USER = "postgres"
DB_PASS = "admin"
DB_PORT = "5432"

def get_db_connection():
    """Tạo kết nối tới Database PostgreSQL"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT,
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"❌ Lỗi kết nối Database: {e}")
        return None

def query_db(query, args=(), one=False):
    """Thực thi câu lệnh SQL và trả về kết quả"""
    conn = get_db_connection()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(query, args)
            rv = cur.fetchall()
            conn.commit()
            return (rv[0] if rv else None) if one else rv
    except Exception as e:
        print(f"❌ Lỗi thực thi truy vấn: {e}")
        return None
    finally:
        conn.close()
