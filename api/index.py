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
VIEWER_PASSWORD = "thdtks1234"

class LoginReq(BaseModel):
    password: str

@app.post("/api/login")
async def login(req: LoginReq):
    pw = req.password.strip()
    if pw == ADMIN_PASSWORD: return {"role": "admin", "token": "admin-token-secure"}
    if pw == VIEWER_PASSWORD: return {"role": "viewer", "token": "viewer-token-secure"}
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

def find_col(columns, keywords):
    for i, col in enumerate(columns):
        col_str = str(col).replace(" ", "")
        if any(k in col_str for k in keywords):
            return i
    return -1

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
        idx_p = find_col(last_df.columns, ["강좌", "프로그램", "과목"])
        idx_d = find_col(last_df.columns, ["요일", "운영일"])
        for _, row in last_df.iterrows():
            p = safe_str(row.iloc[idx_p]) if idx_p != -1 else ""
            d = safe_str(row.iloc[idx_d]) if idx_d != -1 else ""
            if p: subj_days_map[normalize(p)] = d

        # 2. 메인 학생 정보 파싱 (헤더 기반 매핑)
        main_df = pd.read_excel(xl, sheet_name=xl.sheet_names[0])
        cols = main_df.columns
        i_subject = find_col(cols, ["강좌명", "프로그램", "과목"])
        i_inst_n = find_col(cols, ["강사명", "강사", "지도강사"])
        i_inst_c = find_col(cols, ["강사연락처", "강사전화", "연락처"])
        i_grade = find_col(cols, ["학년", "학급"])
        i_class = find_col(cols, ["반"])
        i_num = find_col(cols, ["번호"])
        i_name = find_col(cols, ["이름", "성명", "학생명"])
        i_parent = find_col(cols, ["학부모", "보호자", "연락처"])

        after_school_objs = []
        processed_students = {}
        processed_instructors = {}

        for _, row in main_df.iterrows():
            try:
                name_orig = safe_str(row.iloc[i_name]) if i_name != -1 else ""
                grade_val = str(row.iloc[i_grade]) if i_grade != -1 else ""
                if not name_orig or not grade_val: continue
                
                grade = int(float(grade_val))
                if grade > 2: continue
                
                cls = int(float(str(row.iloc[i_class]))) if i_class != -1 else 0
                num = int(float(str(row.iloc[i_num]))) if i_num != -1 else 0
                parent = safe_str(row.iloc[i_parent]) if i_parent != -1 else ""
                
                key = (grade, cls, normalize(name_orig))
                if key not in processed_students:
                    student = models.Student(grade=grade, class_name=cls, student_number=num, name=name_orig, guardian_contact=parent)
                    db.add(student)
                    db.flush()
                    processed_students[key] = student.id
                
                s_raw = safe_str(row.iloc[i_subject]) if i_subject != -1 else ""
                if s_raw:
                    days = subj_days_map.get(normalize(s_raw), "")
                    for d in ["월", "화", "수", "목", "금"]:
                        if d in s_raw and d not in days: days += d
                    after_school_objs.append(models.AfterSchoolEnrollment(student_id=processed_students[key], subject_name=s_raw, days=days))
                    
                    if i_inst_n != -1:
                        n_s = normalize(s_raw)
                        if n_s not in processed_instructors:
                            processed_instructors[n_s] = models.Instructor(category="방과후", subject_name=s_raw, name=safe_str(row.iloc[i_inst_n]), contact=safe_str(row.iloc[i_inst_c]) if i_inst_c != -1 else "")
            except: continue

        db.add_all(after_school_objs)
        db.add_all(list(processed_instructors.values()))

        # 3. 맞춤형 시트 처리
        c_sheet = [s for s in xl.sheet_names if "맞춤" in s]
        if c_sheet:
            c_df = pd.read_excel(xl, sheet_name=c_sheet[0])
            c_cols = c_df.columns
            ci_g = find_col(c_cols, ["학년"])
            ci_c = find_col(c_cols, ["반"])
            ci_n = find_col(c_cols, ["이름", "성명"])
            ci_p = find_col(c_cols, ["프로그램", "과목"])
            for _, row in c_df.iterrows():
                try:
                    g = int(float(str(row.iloc[ci_g]))) if ci_g != -1 else 0
                    c = int(float(str(row.iloc[ci_c]))) if ci_c != -1 else 0
                    n = normalize(safe_str(row.iloc[ci_n])) if ci_n != -1 else ""
                    sid = processed_students.get((g, c, n))
                    if sid:
                        # 요일별 정보는 고정 위치(4~8)를 쓰되, 향후 필요시 더 확장 가능
                        db.add(models.CustomizedEnrollment(student_id=sid, program_name=safe_str(row.iloc[ci_p]) if ci_p != -1 else "", mon=safe_str(row.iloc[4]), tue=safe_str(row.iloc[5]), wed=safe_str(row.iloc[6]), thu=safe_str(row.iloc[7]), fri=safe_str(row.iloc[8])))
                except: continue

        # 4. 돌봄교실 시트 처리
        r_sheet = [s for s in xl.sheet_names if "돌봄" in s]
        if r_sheet:
            r_df = pd.read_excel(xl, sheet_name=r_sheet[0])
            r_cols = r_df.columns
            ri_g = find_col(r_cols, ["학년"])
            ri_c = find_col(r_cols, ["반"])
            ri_n = find_col(r_cols, ["이름", "성명"])
            ri_r = find_col(r_cols, ["돌봄", "반", "교실"])
            for _, row in r_df.iterrows():
                try:
                    g = int(float(str(row.iloc[ri_g]))) if ri_g != -1 else 0
                    c = int(float(str(row.iloc[ri_c]))) if ri_c != -1 else 0
                    n = normalize(safe_str(row.iloc[ri_n])) if ri_n != -1 else ""
                    room = safe_str(row.iloc[ri_r]) if ri_r != -1 else ""
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
    return {"version": "2.2.9 - Smart Header Mapping"}
