import os
import pandas as pd
import logging
import re
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import Column, String, Integer

try:
    import api.models as models
    from api.database import engine, get_db
    from api.models import Base
except ImportError:
    import models
    from database import engine, get_db
    from models import Base

from pydantic import BaseModel

class SchoolConfig(Base):
    __tablename__ = "school_config"
    id = Column(Integer, primary_key=True, index=True)
    school_name = Column(String, default="OO")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_PASSWORD = "1234"
VIEWER_PASSWORD = "1234"

class LoginReq(BaseModel):
    password: str

@app.post("/api/login")
async def login(req: LoginReq):
    pw = req.password.strip()
    if pw == ADMIN_PASSWORD:
        return {"role": "admin", "token": "admin-token-secure"}
    if pw == VIEWER_PASSWORD:
        return {"role": "viewer", "token": "viewer-token-secure"}
    raise HTTPException(status_code=401, detail="비밀번호 불일치")

@app.get("/api/school-name")
async def get_school_name(db: Session = Depends(get_db)):
    config = db.query(SchoolConfig).first()
    return {"name": config.school_name if config else "OO"}

def normalize(text):
    if not text or pd.isna(text): return ""
    return re.sub(r'[^가-힣a-zA-Z0-9]', '', str(text)).lower()

def safe_str(val):
    if pd.isna(val) or str(val).lower() == "nan": return ""
    return str(val).strip()

@app.post("/api/upload")
async def upload_excel(file: UploadFile = File(...), db: Session = Depends(get_db), authorization: str = Header(None)):
    if authorization != "admin-token-secure":
        raise HTTPException(status_code=403, detail="권한 없음")
    try:
        contents = await file.read()
        file_path = f"/tmp/{file.filename}"
        with open(file_path, "wb") as f: f.write(contents)
        xl = pd.ExcelFile(file_path)
        
        db.query(models.CustomizedEnrollment).delete()
        db.query(models.AfterSchoolEnrollment).delete()
        db.query(models.CareRoomEnrollment).delete()
        db.query(models.Student).delete()
        db.query(models.Instructor).delete()
        db.commit()

        # 1. 요일표 파싱
        subj_days_map = {}
        last_df = pd.read_excel(xl, sheet_name=xl.sheet_names[-1])
        for _, row in last_df.iterrows():
            if len(row) >= 3:
                p, d = safe_str(row.iloc[1]), safe_str(row.iloc[2])
                if p: subj_days_map[normalize(p)] = d

        # 2. 메인 학생 정보 파싱
        main_df = pd.read_excel(xl, sheet_name=xl.sheet_names[0])
        after_school_objs = []
        processed_students = {}
        processed_instructors = {}

        for _, row in main_df.iterrows():
            if len(row) < 8: continue
            s_raw, i_n, i_c = safe_str(row.iloc[0]), safe_str(row.iloc[1]), safe_str(row.iloc[2])
            if s_raw:
                n_s = normalize(s_raw)
                if n_s not in processed_instructors:
                    processed_instructors[n_s] = models.Instructor(category="방과후", subject_name=s_raw, name=i_n, contact=i_c)
            
            try:
                name_orig, g_val = safe_str(row.iloc[6]), str(row.iloc[3])
                if not name_orig: continue
                grade, cls, num = int(float(g_val)), int(float(str(row.iloc[4]))), int(float(str(row.iloc[5])))
                key = (grade, cls, normalize(name_orig))
                
                if key not in processed_students:
                    student = models.Student(grade=grade, class_name=cls, student_number=num, name=name_orig, guardian_contact=safe_str(row.iloc[7]))
                    db.add(student)
                    db.flush()
                    processed_students[key] = student.id
                
                if s_raw:
                    days = subj_days_map.get(normalize(s_raw), "")
                    for d in ["월", "화", "수", "목", "금"]:
                        if d in s_raw and d not in days: days += d
                    after_school_objs.append(models.AfterSchoolEnrollment(student_id=processed_students[key], subject_name=s_raw, days=days))
            except: continue

        db.add_all(after_school_objs)
        db.add_all(list(processed_instructors.values()))

        # 3. 맞춤형 시트 처리
        c_sheet = [s for s in xl.sheet_names if "맞춤" in s]
        if c_sheet:
            c_df = pd.read_excel(xl, sheet_name=c_sheet[0])
            for _, row in c_df.iterrows():
                try:
                    g, c, n = int(float(str(row.iloc[0]))), int(float(str(row.iloc[1]))), normalize(safe_str(row.iloc[2]))
                    sid = processed_students.get((g, c, n))
                    if sid:
                        db.add(models.CustomizedEnrollment(student_id=sid, program_name=safe_str(row.iloc[3]), mon=safe_str(row.iloc[4]), tue=safe_str(row.iloc[5]), wed=safe_str(row.iloc[6]), thu=safe_str(row.iloc[7]), fri=safe_str(row.iloc[8])))
                except: continue

        # 4. 돌봄교실 시트 처리
        r_sheet = [s for s in xl.sheet_names if "돌봄" in s]
        if r_sheet:
            r_df = pd.read_excel(xl, sheet_name=r_sheet[0])
            for _, row in r_df.iterrows():
                try:
                    if len(row) < 4: continue
                    g, c, n = int(float(str(row.iloc[0]))), int(float(str(row.iloc[1]))), normalize(safe_str(row.iloc[2]))
                    room = safe_str(row.iloc[3])
                    sid = processed_students.get((g, c, n))
                    if sid:
                        db.add(models.CareRoomEnrollment(student_id=sid, room_name=room))
                except: continue

        db.commit()
        return {"message": f"성공: {len(processed_students)}명의 데이터가 등록되었습니다."}
    except Exception as e:
        db.rollback()
        return {"message": f"에러: {str(e)}"}

@app.get("/api/stats/overall")
async def get_overall_stats(db: Session = Depends(get_db)):
    # 쿼리 수 최소화
    return {
        "total": db.query(models.Student).count(),
        "custom": db.query(models.CustomizedEnrollment).count(),
        "after": db.query(models.AfterSchoolEnrollment.student_id).distinct().count(),
        "care": db.query(models.CareRoomEnrollment).count()
    }

@app.get("/api/classes")
async def get_classes(db: Session = Depends(get_db)):
    classes = db.query(models.Student.grade, models.Student.class_name).distinct().order_by(models.Student.grade, models.Student.class_name).all()
    return [{"grade": g, "class_name": c} for g, c in classes]

@app.get("/api/dashboard/{grade}/{class_name}")
async def get_dashboard(grade: int, class_name: int, db: Session = Depends(get_db)):
    # 최적화 핵심: joinedload를 사용하여 관계된 데이터를 한 번의 쿼리로 가져옴
    students = db.query(models.Student).options(
        joinedload(models.Student.customized),
        joinedload(models.Student.after_school),
        joinedload(models.Student.care_room)
    ).filter(models.Student.grade == grade, models.Student.class_name == class_name).order_by(models.Student.student_number).all()
    
    res = []
    for s in students:
        res.append({
            "id": s.id, "name": s.name, "student_number": s.student_number, "guardian_contact": s.guardian_contact,
            "customized": {"program": s.customized.program_name, "mon": s.customized.mon, "tue": s.customized.tue, "wed": s.customized.wed, "thu": s.customized.thu, "fri": s.customized.fri} if s.customized else None,
            "after_school": [{"name": a.subject_name, "days": a.days} for a in s.after_school],
            "care_room": s.care_room.room_name if s.care_room else None
        })
    return res

@app.get("/api/instructors")
async def get_instructors(db: Session = Depends(get_db)):
    return db.query(models.Instructor).order_by(models.Instructor.subject_name).all()

@app.get("/api/version")
async def get_version():
    return {"version": "2.2.8 - Performance Optimized"}
