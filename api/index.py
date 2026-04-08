import os
import pandas as pd
import logging
import re
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer
import api.models as models
from api.database import engine, get_db
from pydantic import BaseModel

# SchoolConfig를 models.py 구조에 맞춰 직접 정의하거나 Base를 올바르게 참조
from api.models import Base

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

ADMIN_PASSWORD = "1234"
VIEWER_PASSWORD = "1234"

class LoginRequest(BaseModel):
    password: str

class SchoolNameRequest(BaseModel):
    name: str

@app.get("/api/health")
async def health():
    return {"status": "ok", "message": "API is running"}

@app.post("/api/login")
async def login(req: LoginRequest):
    input_pw = req.password.strip()
    if input_pw == ADMIN_PASSWORD:
        return {"role": "admin", "token": "admin-token-secure"}
    elif input_pw == VIEWER_PASSWORD:
        return {"role": "viewer", "token": "viewer-token-secure"}
    else:
        raise HTTPException(status_code=401, detail="비밀번호 불일치")

@app.get("/api/school-name")
async def get_school_name(db: Session = Depends(get_db)):
    config = db.query(SchoolConfig).first()
    return {"name": config.school_name if config else "OO"}

@app.post("/api/school-name")
async def update_school_name(req: SchoolNameRequest, db: Session = Depends(get_db), authorization: str = Header(None)):
    if authorization != "admin-token-secure":
        raise HTTPException(status_code=403, detail="권한 없음")
    config = db.query(SchoolConfig).first()
    if not config:
        config = SchoolConfig(school_name=req.name)
        db.add(config)
    else:
        config.school_name = req.name
    db.commit()
    return {"message": "Success"}

def normalize(text):
    if not text or pd.isna(text): return ""
    return re.sub(r'[^가-힣a-zA-Z0-9]', '', str(text)).lower()

def safe_str(val):
    if pd.isna(val) or str(val).lower() == "nan": return ""
    return str(val).strip()

@app.get("/api/version")
async def get_version():
    return {"version": "2.2.5 - Path Fixed"}

@app.post("/api/upload")
async def upload_excel(file: UploadFile = File(...), db: Session = Depends(get_db), authorization: str = Header(None)):
    if authorization != "admin-token-secure":
        raise HTTPException(status_code=403, detail="권한 없음")
    try:
        contents = await file.read()
        file_path = f"/tmp/{file.filename}"
        with open(file_path, "wb") as f:
            f.write(contents)
        xl = pd.ExcelFile(file_path)
        db.query(models.CustomizedEnrollment).delete()
        db.query(models.AfterSchoolEnrollment).delete()
        db.query(models.CareRoomEnrollment).delete()
        db.query(models.Student).delete()
        db.query(models.Instructor).delete()
        db.commit()
        
        last_df = pd.read_excel(xl, sheet_name=xl.sheet_names[-1])
        subj_days_map = {}
        for _, row in last_df.iterrows():
            if len(row) < 3: continue
            p, d = safe_str(row.iloc[1]), safe_str(row.iloc[2])
            if p: subj_days_map[normalize(p)] = d
            
        main_df = pd.read_excel(xl, sheet_name=xl.sheet_names[0])
        processed_students = {}
        processed_instructors = {}
        for _, row in main_df.iterrows():
            if len(row) < 8: continue
            s_raw, i_n, i_c = safe_str(row.iloc[0]), safe_str(row.iloc[1]), safe_str(row.iloc[2])
            if s_raw:
                n_s = normalize(s_raw)
                if n_s not in processed_instructors: processed_instructors[n_s] = {"subject": s_raw, "name": i_n, "contact": i_c}
            try:
                name_orig, grade_val = safe_str(row.iloc[6]), str(row.iloc[3])
                grade = int(float(grade_val))
                if grade > 2: continue
                cls, num, p_p = int(float(str(row.iloc[4]))), int(float(str(row.iloc[5]))), safe_str(row.iloc[7])
                n_n = normalize(name_orig)
                key = (grade, cls, n_n)
                if key not in processed_students:
                    student = models.Student(grade=grade, class_name=cls, student_number=num, name=name_orig, guardian_contact=p_p)
                    db.add(student)
                    db.flush()
                    processed_students[key] = student.id
                if s_raw:
                    days = subj_days_map.get(normalize(s_raw), "")
                    for d in ["월", "화", "수", "목", "금"]:
                        if d in s_raw and d not in days: days += d
                    db.add(models.AfterSchoolEnrollment(student_id=processed_students[key], subject_name=s_raw, days=days))
            except: continue
            
        for k in processed_instructors:
            ins = processed_instructors[k]
            db.add(models.Instructor(category="방과후", subject_name=ins["subject"], name=ins["name"], contact=ins["contact"]))
        
        c_sheet = [s for s in xl.sheet_names if "맞춤" in s]
        if c_sheet:
            c_df = pd.read_excel(xl, sheet_name=c_sheet[0])
            for _, row in c_df.iterrows():
                try:
                    g, c = int(float(str(row.iloc[0]))), int(float(str(row.iloc[1])))
                    sid = processed_students.get((g, c, normalize(safe_str(row.iloc[2]))))
                    if sid: db.add(models.CustomizedEnrollment(student_id=sid, program_name=safe_str(row.iloc[3]), mon=safe_str(row.iloc[4]), tue=safe_str(row.iloc[5]), wed=safe_str(row.iloc[6]), thu=safe_str(row.iloc[7]), fri=safe_str(row.iloc[8])))
                except: continue
                
        r_sheet = [s for s in xl.sheet_names if "돌봄" in s]
        if r_sheet:
            r_df = pd.read_excel(xl, sheet_name=r_sheet[0])
            for _, row in r_df.iterrows():
                try:
                    g_care = int(float(str(row.iloc[0])))
                    n_care = normalize(safe_str(row.iloc[2]))
                    if not n_care or len(n_care) < 2: n_care = normalize(safe_str(row.iloc[3]))
                    room_val = safe_str(row.iloc[3]) if "돌봄" in safe_str(row.iloc[3]) else safe_str(row.iloc[4])
                    for (sg, sc, sn), sid in processed_students.items():
                        if sg == g_care and sn == n_care:
                            db.add(models.CareRoomEnrollment(student_id=sid, room_name=room_val))
                            break
                except: continue
        db.commit()
        return {"message": "Success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats/overall")
async def get_overall_stats(db: Session = Depends(get_db)):
    return {"total": db.query(models.Student).count(), "custom": db.query(models.CustomizedEnrollment).count(), "after": db.query(models.AfterSchoolEnrollment.student_id).distinct().count(), "care": db.query(models.CareRoomEnrollment).count()}

@app.get("/api/classes")
async def get_classes(db: Session = Depends(get_db)):
    classes = db.query(models.Student.grade, models.Student.class_name).distinct().order_by(models.Student.grade, models.Student.class_name).all()
    return [{"grade": g, "class_name": c} for g, c in classes]

@app.get("/api/dashboard/{grade}/{class_name}")
async def get_dashboard(grade: int, class_name: int, db: Session = Depends(get_db)):
    students = db.query(models.Student).filter(models.Student.grade == grade, models.Student.class_name == class_name).order_by(models.Student.student_number).all()
    result = []
    for s in students:
        result.append({"id": s.id, "name": s.name, "student_number": s.student_number, "guardian_contact": s.guardian_contact, "customized": {"program": s.customized.program_name, "mon": s.customized.mon, "tue": s.customized.tue, "wed": s.customized.wed, "thu": s.customized.thu, "fri": s.customized.fri} if s.customized else None, "after_school": [{"name": a.subject_name, "days": a.days} for a in s.after_school], "care_room": s.care_room.room_name if s.care_room else None})
    return result

@app.get("/api/instructors")
async def get_instructors(db: Session = Depends(get_db)):
    return db.query(models.Instructor).order_by(models.Instructor.subject_name).all()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
