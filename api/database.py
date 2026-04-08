from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Vercel 환경에서는 쓰기 가능한 /tmp 폴더를 사용하거나 현재 폴더의 db 파일을 사용
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./school.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
