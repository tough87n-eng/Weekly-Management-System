import os
import pandas as pd
import logging
import re
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer
from . import models
from .database import engine, get_db
from pydantic import BaseModel

# SchoolConfig를 models.py 구조에 맞춰 직접 정의하거나 Base를 올바르게 참조
from .models import Base

class SchoolConfig(Base):
    __tablename__ = "school_config"
    id = Column(Integer, primary_key=True, index=True)
    school_name = Column(String, default="OO")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 테스트를 위해 비밀번호를 간단히 1234로 변경해 봅니다.
ADMIN_PASSWORD = "1234"
VIEWER_PASSWORD = "1234"

class LoginRequest(BaseModel):
    password: str
