import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Phone, Upload, GraduationCap, Calendar, ChevronRight, Home, User, Sparkles, BookOpen, ShieldCheck, LayoutDashboard, Lock, LogOut, Heart, Edit3, Check } from 'lucide-react';

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
  const [version, setVersion] = useState('');
  
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
    axios.get(`${API_BASE_URL}/version`).then(res => setVersion(res.data.version)).catch(() => {});
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
    } catch (err) {
      alert("비밀번호가 올바르지 않습니다.");
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
      await axios.post(`${API_BASE_URL}/upload`, fd, {
        headers: { 'Authorization': token }
      });
      alert("데이터 업로드 성공!");
      fetchClasses();
      fetchInstructors();
      fetchOverallStats();
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
          <div className="bg-indigo-600 p-10 text-white text-center">
            <GraduationCap size={60} className="mx-auto mb-4" />
            <h1 className="text-2xl font-black tracking-tighter">맞춤형 돌봄(방과후) 대시보드</h1>
            <p className="text-indigo-100 mt-2 font-medium opacity-80">학부모 및 강사 연락망 통합 시스템</p>
          </div>
          <form onSubmit={handleLogin} className="p-10 space-y-6">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-center text-xl tracking-widest placeholder:text-slate-300"
              placeholder="Password"
              autoFocus
            />
            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-600 transition-all shadow-xl active:scale-95">
              접속하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  const stats = selectedClass === 'overall' ? overallStats : {
    custom: students.filter(s => s.customized).length,
    after: students.filter(s => s.after_school.length > 0).length,
    care: students.filter(s => s.care_room).length
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 shadow-2xl border-r border-white/5">
        <div className="p-6 border-b border-slate-800 bg-slate-800/50">
          <h1 className="text-lg font-black flex flex-col tracking-tighter">
            <span className="text-indigo-400 text-[10px] uppercase mb-1">Dashboard v2.2.2</span>
            <span>맞춤형 돌봄(방과후)</span>
          </h1>
          <div className="flex items-center justify-between mt-4">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{userRole === 'admin' ? 'Admin' : 'Teacher'}</span>
            <button onClick={handleLogout} className="text-[9px] text-slate-500 hover:text-white flex items-center transition-colors"><LogOut size={10} className="mr-1" /> 로그아웃</button>
          </div>
        </div>
        
        {userRole === 'admin' && (
          <div className="p-4 border-b border-slate-800/50 space-y-2">
            <label className="flex items-center justify-center w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl cursor-pointer transition-all shadow-lg text-xs font-bold border border-indigo-400/20">
              <Upload size={16} className="mr-2" /> 엑셀 파일 업데이트
              <input type="file" className="hidden" onChange={handleUpload} accept=".xlsx" />
            </label>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <button onClick={() => setSelectedClass('overall')} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center mb-4 ${selectedClass === 'overall' ? 'bg-white text-indigo-950 shadow-md' : 'hover:bg-slate-800 text-slate-400'}`}>
            <LayoutDashboard size={18} className="mr-2" /> 전체 현황 대시보드
          </button>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-2">학급별 현황 (1,2학년)</p>
          {classes.map((cls, idx) => (
            <button key={idx} onClick={() => setSelectedClass(cls)} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex justify-between items-center ${typeof selectedClass !== 'string' && selectedClass?.grade === cls.grade && selectedClass?.class_name === cls.class_name ? 'bg-indigo-600 text-white shadow-md transform scale-105' : 'hover:bg-slate-800 text-slate-400'}`}>
              <span>{cls.grade}학년 {cls.class_name}반</span>
              <ChevronRight size={14} className={typeof selectedClass !== 'string' && selectedClass?.grade === cls.grade && selectedClass?.class_name === cls.class_name ? 'opacity-100' : 'opacity-0'} />
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-10 relative">
        <header className="mb-10 flex justify-between items-start">
          <div className="flex-1">
            {selectedClass === 'overall' && userRole === 'admin' ? (
              <div className="flex items-center space-x-2">
                {isEditingSchool ? (
                  <div className="flex items-center bg-white border rounded-2xl px-4 py-2 shadow-sm border-indigo-200">
                    <input 
                      value={newSchoolName} 
                      onChange={e => setNewSchoolName(e.target.value)}
                      className="bg-transparent outline-none font-black text-2xl text-slate-800"
                      autoFocus
                    />
                    <button onClick={updateSchoolName} className="ml-2 p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-md"><Check size={18} /></button>
                  </div>
                ) : (
                  <div className="flex items-center group cursor-pointer" onClick={() => setIsEditingSchool(true)}>
                    <h2 className="text-4xl font-black text-slate-800 tracking-tight">{schoolName}초등학교 <span className="text-indigo-500">Overview</span></h2>
                    <Edit3 size={18} className="ml-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                )}
              </div>
            ) : (
              <h2 className="text-4xl font-black text-slate-800 tracking-tight">{selectedClass === 'overall' ? `${schoolName}초등학교 전체 현황` : `${(selectedClass as ClassInfo).grade}학년 ${(selectedClass as ClassInfo).class_name}반 현황`}</h2>
            )}
            <p className="text-slate-500 mt-2 font-medium italic">Weekly Management System</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100 flex overflow-hidden">
            <div className="px-6 py-3 text-center border-r"><div className="flex items-center justify-center text-violet-600 mb-1 space-x-1"><Sparkles size={14} /><span className="text-[10px] font-black uppercase tracking-tighter">맞춤형</span></div><p className="text-xl font-black text-violet-600 leading-none mt-1">{stats?.custom || 0}명</p></div>
            <div className="px-6 py-3 text-center border-r font-black"><div className="flex items-center justify-center text-emerald-600 mb-1 space-x-1"><BookOpen size={14} /><span className="text-[10px] font-black uppercase tracking-tighter">방과후</span></div><p className="text-xl font-black text-emerald-600 leading-none mt-1">{stats?.after || 0}명</p></div>
            <div className="px-6 py-3 text-center font-black"><div className="flex items-center justify-center text-amber-600 mb-1 space-x-1"><Home size={14} /><span className="text-[10px] font-black uppercase tracking-tighter">돌봄교실</span></div><p className="text-xl font-black text-amber-600 leading-none mt-1">{stats?.care || 0}명</p></div>
          </div>
        </header>

        {loading ? <div className="py-32 text-center italic text-slate-400">데이터 로드 중...</div> : (
          <div className="space-y-12">
            {selectedClass === 'overall' ? (
              <div className="space-y-10 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 border-t-4 border-t-slate-400">
                    <div className="flex items-center text-slate-400 mb-4 font-black text-[10px] uppercase tracking-widest"><Users size={16} className="mr-2" /> 전체 학생 수</div>
                    <p className="text-4xl font-black text-slate-800">{overallStats?.total || 0} <span className="text-sm text-slate-400">명</span></p>
                  </div>
                  <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 border-t-4 border-t-violet-500">
                    <div className="flex items-center text-violet-500 mb-4 font-black text-[10px] uppercase tracking-widest"><Sparkles size={16} className="mr-2" /> 맞춤형 신청</div>
                    <p className="text-4xl font-black text-slate-800">{overallStats?.custom || 0} <span className="text-sm text-slate-400 font-bold uppercase tracking-widest">Enrollments</span></p>
                  </div>
                  {/* ... other summary boxes can go here ... */}
                </div>
                <section className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                   <div className="relative z-10">
                      <div className="flex items-center space-x-2 mb-6 text-indigo-400">
                        <ShieldCheck size={24} />
                        <span className="text-xs font-black uppercase tracking-[0.3em]">Management Information</span>
                      </div>
                      <h3 className="text-3xl font-black mb-6 text-white leading-tight">
                        {schoolName}초등학교 맞춤형 돌봄(방과후) <br/>
                        <span className="text-indigo-400">효율적 운영을 위해 제작된 통합 시스템</span>
                      </h3>
                      <p className="text-indigo-100/60 leading-loose max-w-2xl font-medium">
                        본 시스템은 실시간 수강 현황 파악과 비상 연락망 공유를 목적으로 합니다. <br/>
                        데이터의 보안을 위해 외부 유출에 주의해 주시기 바랍니다.
                      </p>
                   </div>
                   <div className="absolute right-10 bottom-10 flex items-center space-x-2 bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-full backdrop-blur-md border border-white/10 transition-all duration-300 cursor-default group-hover:scale-110">
                      <Heart size={14} className="text-rose-400 fill-rose-400 animate-pulse" />
                      <span className="text-[11px] font-black tracking-widest text-white/90">made by 최지영샘</span>
                   </div>
                   <GraduationCap size={280} className="absolute -right-20 -top-20 text-white/5 rotate-12 pointer-events-none group-hover:text-white/10 transition-all duration-700" />
                </section>
              </div>
            ) : (
              <section className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden text-center mb-10 border-t-4 border-t-indigo-600">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest w-56 border-r text-center">성명 / 소속</th>
                        {['월', '화', '수', '목', '금'].map(d => <th key={d} className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center border-r">{d}요일</th>)}
                        <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest w-48 text-center">학부모 연락처</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {students.map(s => (
                        <tr key={s.id} className="hover:bg-indigo-50/20 transition-colors group text-center">
                          <td className="p-6 font-black border-r text-center">
                            <div className="flex flex-col items-center space-y-2">
                              <span className="text-lg text-slate-800">{s.name} <span className="text-xs text-slate-400 font-bold">({s.student_number})</span></span>
                              <div className="flex flex-wrap gap-1.5 justify-center">
                                  {s.customized && <span className="inline-flex items-center px-2 py-1 rounded-md bg-violet-100 text-violet-700 text-[9px] font-black"><Sparkles size={10} className="mr-1" /> {s.customized.program}</span>}
                                  {s.care_room && <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-100 text-amber-700 text-[9px] font-black"><Home size={10} className="mr-1" /> {s.care_room}</span>}
                              </div>
                            </div>
                          </td>
                          {['mon', 'tue', 'wed', 'thu', 'fri'].map((dk, i) => (
                            <td key={dk} className="p-2 align-middle border-r w-1/6">
                              <div className="flex flex-col items-center space-y-1 justify-center min-h-[80px]">
                                {getDaySchedule(s, dk, ['월','화','수','목','금'][i]).map((it, idx) => (
                                  <div key={idx} className={`w-full max-w-[140px] p-2 rounded-lg text-[9px] font-black leading-tight shadow-sm border-l-4 text-center flex items-center justify-center ${it.type==='custom'?'bg-violet-50 text-violet-700 border-violet-500':'bg-emerald-50 text-emerald-700 border-emerald-500'}`}>
                                    {it.type === 'custom' ? <Sparkles size={8} className="mr-1 flex-shrink-0" /> : <BookOpen size={8} className="mr-1 flex-shrink-0" />}
                                    {it.label}
                                  </div>
                                ))}
                              </div>
                            </td>
                          ))}
                          <td className="p-6 text-center font-black text-slate-600 group-hover:text-indigo-600 transition-colors whitespace-nowrap tabular-nums italic text-sm">{s.guardian_contact}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="mt-12 bg-white p-10 rounded-[2rem] border border-slate-100 shadow-lg mb-20">
               <div className="mb-8 text-center border-b pb-6 border-slate-50">
                  <h3 className="text-2xl font-black text-slate-800 flex items-center justify-center tracking-tight"><ShieldCheck className="mr-2 text-indigo-500" /> 프로그램별 강사 연락망</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest italic tracking-[0.2em]">Full Instructor Directory</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-center">
                  {instructors.map((inst, idx) => (
                    <div key={idx} className="p-6 border rounded-2xl bg-slate-50/50 flex flex-col justify-between hover:border-indigo-200 transition-all group shadow-sm">
                       <div className="mb-4">
                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-emerald-100 mb-2 inline-flex items-center"><BookOpen size={8} className="mr-1" /> {inst.category}</span>
                          <h4 className="font-black text-slate-800 text-lg leading-snug group-hover:text-indigo-600">{inst.subject_name}</h4>
                       </div>
                       <div className="flex items-center bg-white p-3 rounded-xl border border-slate-100 shadow-inner">
                          <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-700 border-r border-slate-100">
                             <User size={14} className="mr-2 text-indigo-400" /> {inst.name || '강사'}
                          </div>
                          <div className="flex-1 flex items-center justify-center text-xs font-bold text-indigo-600 pl-2">
                             <Phone size={14} className="mr-2 text-indigo-400" /> <span className="tabular-nums">{inst.contact || '미등록'}</span>
                          </div>
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
