from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Vercel Postgres 주소가 있으면 사용하고, 없으면 SQLite(로컬용)를 사용합니다.
# SQLAlchemy 1.4+ 에서는 'postgres://' 대신 'postgresql://'을 명시해야 합니다.
DATABASE_URL = os.getenv("POSTGRES_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not DATABASE_URL:
    DATABASE_URL = "sqlite:////tmp/school.db"

# Postgres와 SQLite의 접속 옵션을 다르게 설정합니다.
if "sqlite" in DATABASE_URL:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # Postgres의 경우 안정적인 연결을 위해 추가 옵션을 사용합니다.
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
