from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    grade = Column(Integer)
    class_name = Column(Integer)
    student_number = Column(Integer)
    name = Column(String)
    guardian_contact = Column(String)
    
    # Relationships
    customized = relationship("CustomizedEnrollment", back_populates="student", uselist=False)
    after_school = relationship("AfterSchoolEnrollment", back_populates="student")
    care_room = relationship("CareRoomEnrollment", back_populates="student", uselist=False)

class CustomizedEnrollment(Base):
    __tablename__ = "customized_enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    program_name = Column(String)
    mon = Column(String)
    tue = Column(String)
    wed = Column(String)
    thu = Column(String)
    fri = Column(String)
    
    student = relationship("Student", back_populates="customized")

class AfterSchoolEnrollment(Base):
    __tablename__ = "after_school_enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    subject_name = Column(String)
    days = Column(String) # 요일 정보 저장 (예: "월,수,금")
    
    student = relationship("Student", back_populates="after_school")

class CareRoomEnrollment(Base):
    __tablename__ = "care_room_enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    room_name = Column(String)
    
    student = relationship("Student", back_populates="care_room")

class Instructor(Base):
    __tablename__ = "instructors"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String)
    subject_name = Column(String)
    name = Column(String)
    contact = Column(String)
