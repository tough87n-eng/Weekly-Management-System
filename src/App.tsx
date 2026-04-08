import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Phone, Upload, GraduationCap, Calendar, ChevronRight, Home, User, Sparkles, BookOpen, ShieldCheck, LayoutDashboard, Lock, LogOut, Heart, Edit3, Check, Menu, X } from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '/api';

interface Student {
  id: number; name: string; student_number: number; guardian_contact: string;
  customized: { program: string; mon: string; tue: string; wed: string; thu: string; fri: string; } | null;
  after_school: { name: string; days: string }[];
  care_room: string | null;
}

interface Instructor {
  id: number; category: string; subject_name: string; name: string; contact: string;
}

interface ClassInfo { grade: number; class_name: number; }

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'viewer' | null>(null);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | 'overall'>('overall');
  const [students, setStudents] = useState<Student[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [overallStats, setOverallStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // 모바일 메뉴 상태
  
  const [schoolName, setSchoolName] = useState('OO');
  const [isEditingSchool, setIsEditingSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('school_token');
    const savedRole = localStorage.getItem('school_role') as any;
    if (savedToken && savedRole) {
      setToken(savedToken);
      setUserRole(savedRole);
      setIsLoggedIn(true);
    }
    fetchSchoolName();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchClasses();
      fetchInstructors();
      fetchOverallStats();
      fetchSchoolName();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      if (selectedClass === 'overall') fetchOverallStats();
      else if (selectedClass) fetchDashboard(selectedClass.grade, selectedClass.class_name);
      setIsMenuOpen(false); // 메뉴 선택 시 닫기
    }
  }, [selectedClass, isLoggedIn]);

  const fetchSchoolName = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/school-name`);
      setSchoolName(res.data.name);
      setNewSchoolName(res.data.name);
    } catch (err) {}
  };

  const updateSchoolName = async () => {
    try {
      await axios.post(`${API_BASE_URL}/school-name`, { name: newSchoolName }, {
        headers: { 'Authorization': token }
      });
      setSchoolName(newSchoolName);
      setIsEditingSchool(false);
    } catch (err) { alert("학교명 수정 실패"); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE_URL}/login`, { password });
      const { role, token } = res.data;
      setToken(token);
      setUserRole(role);
      setIsLoggedIn(true);
      localStorage.setItem('school_token', token);
      localStorage.setItem('school_role', role);
    } catch (err: any) {
      if (err.response?.status === 401) alert("비밀번호가 올바르지 않습니다.");
      else alert("서버 연결 실패 (Error: " + (err.response?.status || err.message) + ")");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole(null);
    setToken('');
    localStorage.clear();
  };

  const fetchOverallStats = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stats/overall`);
      setOverallStats(res.data);
    } catch (err) {}
  };

  const fetchClasses = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/classes`);
      setClasses(res.data.filter((c: any) => c.grade <= 2));
    } catch (err) {}
  };

  const fetchInstructors = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/instructors`);
      setInstructors(res.data);
    } catch (err) {}
  };

  const fetchDashboard = async (g: number, c: number) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/dashboard/${g}/${c}`);
      setStudents(res.data);
    } catch (err) {}
    finally { setLoading(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const fd = new FormData();
    fd.append('file', e.target.files[0]);
    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/upload`, fd, { headers: { 'Authorization': token } });
      alert("데이터 업로드 성공!");
      fetchClasses(); fetchInstructors(); fetchOverallStats();
    } catch (err) { alert("업로드 실패"); }
    finally { setLoading(false); }
  };

  const getDaySchedule = (s: Student, dayKey: string, dayLabel: string) => {
    const items = [];
    const dayChar = dayLabel.charAt(0);
    if (s.customized && (s.customized as any)[dayKey]) {
        const t = (s.customized as any)[dayKey];
        if (t && t !== "nan") items.push({ type: 'custom', label: t });
    }
    if (s.after_school) {
      s.after_school.forEach(as => {
        if (as.days.includes(dayChar)) items.push({ type: 'after', label: as.name });
      });
    }
    return items;
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
          <div className="bg-indigo-600 p-8 md:p-10 text-white text-center">
            <GraduationCap size={50} className="mx-auto mb-4" />
            <h1 className="text-xl md:text-2xl font-black tracking-tighter leading-tight">송산초 맞춤형 돌봄<br/>통합 대시보드</h1>
          </div>
          <form onSubmit={handleLogin} className="p-8 md:p-10 space-y-6">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-center text-xl tracking-widest"
              placeholder="비밀번호 입력"
            />
            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-600 transition-all shadow-xl">
              접속하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  const stats = selectedClass === 'overall' ? overallStats : {
    total: students.length,
    custom: students.filter(s => s.customized).length,
    after: students.filter(s => s.after_school.length > 0).length,
    care: students.filter(s => s.care_room).length
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* 모바일 헤더 */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg z-50">
        <div className="flex items-center space-x-2">
          <GraduationCap className="text-indigo-400" size={24} />
          <h1 className="font-black text-sm tracking-tighter">송산초 대시보드</h1>
        </div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 bg-slate-800 rounded-lg">
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* 사이드바 (PC 상시, 모바일 슬라이딩) */}
      <aside className={`fixed inset-y-0 left-0 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 shadow-2xl transition-transform duration-300 z-40`}>
        <div className="p-6 border-b border-slate-800 hidden md:block">
          <h1 className="text-lg font-black tracking-tighter">맞춤형 돌봄 대시보드</h1>
          <div className="flex items-center justify-between mt-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{userRole === 'admin' ? 'Admin' : 'Teacher'}</span>
            <button onClick={handleLogout} className="text-[10px] text-slate-400 hover:text-white flex items-center"><LogOut size={12} className="mr-1" /> 로그아웃</button>
          </div>
        </div>
        
        {userRole === 'admin' && (
          <div className="p-4 border-b border-slate-800/50">
            <label className="flex items-center justify-center w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl cursor-pointer transition-all shadow-lg text-xs font-bold">
              <Upload size={16} className="mr-2" /> 엑셀 업데이트
              <input type="file" className="hidden" onChange={handleUpload} accept=".xlsx" />
            </label>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <button onClick={() => setSelectedClass('overall')} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center mb-4 ${selectedClass === 'overall' ? 'bg-white text-indigo-950 shadow-md' : 'hover:bg-slate-800 text-slate-400'}`}>
            <LayoutDashboard size={18} className="mr-2" /> 전체 현황
          </button>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-2">학급 선택 (1,2학년)</p>
          {classes.map((cls, idx) => (
            <button key={idx} onClick={() => setSelectedClass(cls)} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-between items-center ${typeof selectedClass !== 'string' && selectedClass?.grade === cls.grade && selectedClass?.class_name === cls.class_name ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 text-slate-400'}`}>
              <span>{cls.grade}-{cls.class_name}</span>
              <ChevronRight size={14} className={typeof selectedClass !== 'string' && selectedClass?.grade === cls.grade && selectedClass?.class_name === cls.class_name ? 'opacity-100' : 'opacity-30'} />
            </button>
          ))}
          <div className="md:hidden mt-10 p-4 border-t border-slate-800">
             <button onClick={handleLogout} className="w-full flex items-center justify-center py-3 bg-slate-800 rounded-xl text-sm font-bold text-rose-400"><LogOut size={16} className="mr-2" /> 로그아웃</button>
          </div>
        </nav>
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto p-4 md:p-10 relative">
        <header className="mb-6 md:mb-10 flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="w-full md:w-auto">
            <h2 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight">
              {selectedClass === 'overall' ? `${schoolName}초 전체 현황` : `${(selectedClass as any).grade}-${(selectedClass as any).class_name}반 현황`}
            </h2>
            <p className="text-slate-500 mt-1 font-medium text-sm">Weekly Management System</p>
          </div>
          
          <div className="grid grid-cols-3 w-full md:w-auto bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
            <div className="px-4 py-2 text-center border-r"><span className="block text-[8px] font-black text-violet-500 uppercase">맞춤형</span><p className="text-lg font-black text-violet-600">{stats?.custom || 0}</p></div>
            <div className="px-4 py-2 text-center border-r"><span className="block text-[8px] font-black text-emerald-500 uppercase">방과후</span><p className="text-lg font-black text-emerald-600">{stats?.after || 0}</p></div>
            <div className="px-4 py-2 text-center"><span className="block text-[8px] font-black text-amber-500 uppercase">돌봄</span><p className="text-lg font-black text-amber-600">{stats?.care || 0}</p></div>
          </div>
        </header>

        {loading ? <div className="py-20 text-center italic text-slate-400">데이터 로딩 중...</div> : (
          <div className="space-y-6 md:space-y-12">
            {selectedClass === 'overall' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                   <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg border-t-4 border-t-slate-400">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">학생 총원</span>
                      <p className="text-3xl md:text-4xl font-black">{overallStats?.total || 0}<span className="text-sm ml-1">명</span></p>
                   </div>
                   <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg border-t-4 border-t-violet-500">
                      <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest block mb-2">맞춤형 신청</span>
                      <p className="text-3xl md:text-4xl font-black">{overallStats?.custom || 0}<span className="text-sm ml-1">건</span></p>
                   </div>
                </div>
                <section className="bg-indigo-900 text-white p-8 md:p-12 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                   <div className="relative z-10">
                      <h3 className="text-xl md:text-3xl font-black mb-4">송산초 통합 대시보드</h3>
                      <p className="text-indigo-200 text-xs md:text-sm leading-relaxed max-w-xl">실시간 수강 현황과 비상 연락망을 확인하세요. 모바일에서도 카드 형태로 편리하게 보실 수 있습니다.</p>
                   </div>
                   <div className="absolute right-6 bottom-6 flex items-center space-x-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                      <Heart size={12} className="text-rose-400 fill-rose-400" />
                      <span className="text-[10px] font-bold text-white/90 tracking-widest">made by 최지영샘</span>
                   </div>
                </section>
              </div>
            ) : (
              <>
                {/* PC 테이블 뷰 (태블릿 이상) */}
                <div className="hidden lg:block bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-10 border-t-4 border-t-indigo-600">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100">
                          <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest w-56 border-r text-center">성명 / 소속</th>
                          {['월', '화', '수', '목', '금'].map(d => <th key={d} className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center border-r">{d}요일</th>)}
                          <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest w-48 text-center">비상연락망</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {students.map(s => (
                          <tr key={s.id} className="hover:bg-indigo-50/20 transition-colors group">
                            <td className="p-6 border-r">
                              <div className="flex flex-col items-center space-y-2">
                                <span className="text-lg font-black text-slate-800">{s.name} <span className="text-xs text-slate-400">({s.student_number})</span></span>
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {s.customized && <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-700 text-[9px] font-black">{s.customized.program}</span>}
                                  {s.care_room && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-black">{s.care_room}</span>}
                                </div>
                              </div>
                            </td>
                            {['mon', 'tue', 'wed', 'thu', 'fri'].map((dk, i) => (
                              <td key={dk} className="p-2 border-r align-top">
                                <div className="flex flex-col space-y-1.5 min-h-[100px] items-center">
                                  {getDaySchedule(s, dk, ['월','화','수','목','금'][i]).map((it, idx) => (
                                    <div key={idx} className={`w-full max-w-[180px] p-3 rounded-xl text-base font-black text-center shadow-sm border-l-4 ${it.type==='custom'?'bg-violet-50 text-violet-700 border-violet-500':'bg-emerald-50 text-emerald-700 border-emerald-500'}`}>
                                      {it.label}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            ))}
                            <td className="p-6 text-center font-black text-slate-600 text-sm tabular-nums">{s.guardian_contact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 모바일 카드 뷰 (핸드폰 전용) */}
                <div className="lg:hidden space-y-4">
                  {students.map(s => (
                    <div key={s.id} className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 border-l-8 border-l-indigo-600">
                      <div className="flex justify-between items-start mb-4 border-b pb-4 border-slate-50">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xl font-black text-slate-800">{s.name}</span>
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{s.student_number}번</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {s.customized && <span className="px-2 py-0.5 rounded-lg bg-violet-50 text-violet-600 text-[10px] font-black"># {s.customized.program}</span>}
                            {s.care_room && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black"># {s.care_room}</span>}
                          </div>
                        </div>
                        <a href={`tel:${s.guardian_contact}`} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                          <Phone size={20} />
                        </a>
                      </div>

                      <div className="space-y-3">
                        {['월', '화', '수', '목', '금'].map((day, idx) => {
                          const items = getDaySchedule(s, ['mon', 'tue', 'wed', 'thu', 'fri'][idx], day);
                          if (items.length === 0) return null;
                          return (
                            <div key={day} className="flex items-start">
                              <span className="w-10 text-xs font-black text-slate-400 mt-1">{day}</span>
                              <div className="flex-1 flex flex-wrap gap-2">
                                {items.map((it, i) => (
                                  <span key={i} className={`px-3 py-1.5 rounded-xl text-sm font-black border-l-4 shadow-sm ${it.type==='custom'?'bg-violet-50 text-violet-700 border-violet-500':'bg-emerald-50 text-emerald-700 border-emerald-500'}`}>
                                    {it.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 강사 연락망 (모바일에서는 카드 그리드) */}
            <section className="mt-8 bg-white p-6 md:p-10 rounded-[2rem] border border-slate-100 shadow-lg mb-10">
               <div className="mb-6 border-b pb-4 flex justify-between items-end">
                  <h3 className="text-xl md:text-2xl font-black text-slate-800 flex items-center"><ShieldCheck className="mr-2 text-indigo-500" /> 강사 연락망</h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {instructors.map((inst, idx) => (
                    <div key={idx} className="p-5 border rounded-2xl bg-slate-50/50 flex flex-col justify-between hover:border-indigo-200 transition-all">
                       <div className="mb-3">
                          <span className="text-[9px] font-black text-emerald-600 uppercase bg-white px-2 py-0.5 rounded border border-emerald-100 mb-2 inline-block">{inst.category}</span>
                          <h4 className="font-black text-slate-800 text-base leading-tight">{inst.subject_name}</h4>
                       </div>
                       <div className="flex items-center bg-white p-2 rounded-xl border border-slate-100 shadow-inner mt-2">
                          <div className="flex-1 flex items-center justify-center text-xs font-bold border-r"><User size={12} className="mr-1 text-slate-400" /> {inst.name}</div>
                          <a href={`tel:${inst.contact}`} className="flex-1 flex items-center justify-center text-xs font-bold text-indigo-600 pl-1"><Phone size={12} className="mr-1" /> {inst.contact}</a>
                       </div>
                    </div>
                  ))}
               </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
export default App;
