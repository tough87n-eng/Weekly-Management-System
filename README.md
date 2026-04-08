# 수강신청 현황 대시보드 프로젝트

이 프로젝트는 다중 시트 엑셀 파일을 업로드하여 학급별 수강 현황(맞춤형, 방과후, 돌봄교실)을 한눈에 확인할 수 있는 웹 대시보드입니다.

## 주요 기능
- 다중 시트 엑셀 업로드 (`2026-01_수강리스트1.xlsx` 구조 최적화)
- 학급별(학년/반) 필터링 대시보드
- 수강 유형별(맞춤형, 방과후, 돌봄교실) 요약 및 상세 내역
- 학생 보호자 연락처 및 과목별 강사 연락처 확인

## 실행 방법

### 1. 백엔드 (FastAPI) 실행
```bash
cd backend
# 가상환경 설정 (권장)
python -m venv venv
source venv/bin/activate # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```
서버는 `http://localhost:8000`에서 실행됩니다.

### 2. 프론트엔드 (React) 실행
```bash
cd frontend
npm install
npm run dev
```
웹사이트는 `http://localhost:3000`에서 실행됩니다.

## 기술 스택
- **Backend:** Python, FastAPI, Pandas, SQLAlchemy (SQLite)
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Lucide React
