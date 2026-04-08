from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# 사용자께서 제공해주신 Vercel Postgres(Prisma) 주소입니다.
# 우선 환경 변수(POSTGRES_URL)를 찾고, 없으면 직접 주신 주소를 사용합니다.
DATABASE_URL = os.getenv("POSTGRES_URL", "postgres://376db56b434833beb099889a165710e5201995fbc20a192eb0a160acec7b42ed:sk_8TTM8wqwOY-4Y6qWyHMOj@db.prisma.io:5432/postgres?sslmode=require")

# SQLAlchemy 최신 버전 대응 (postgres:// -> postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 엔진 설정 (Postgres 안정성 옵션 추가)
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,
    pool_recycle=3600
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
