'use client';

import React, { useState, useEffect } from 'react';
import { useParent } from '../ParentContext';
import { api } from '@/lib/api';
import { Clock, BookOpen, User, Calendar as CalendarIcon, Info, Utensils, Coffee } from 'lucide-react';

function getSubjectName(period: any): string {
  if (!period) return 'Subject';
  if (typeof period.subject === 'string' && period.subject) return period.subject;
  if (typeof period.subjectName === 'string' && period.subjectName) return period.subjectName;
  if (period.subject && typeof period.subject === 'object' && period.subject.name) return period.subject.name;
  return 'Subject';
}

function getTeacherName(period: any): string {
  if (!period) return 'Teacher';
  if (typeof period.teacher === 'string' && period.teacher) return period.teacher;
  if (typeof period.teacherName === 'string' && period.teacherName) return period.teacherName;
  if (period.teacher && typeof period.teacher === 'object' && period.teacher.name) return period.teacher.name;
  return 'Teacher';
}

function getStartTime(period: any): string {
  if (!period) return '09:00 AM';
  return period.startTime || period.periodTiming?.startTime || '09:00 AM';
}

function getEndTime(period: any): string {
  if (!period) return '09:45 AM';
  return period.endTime || period.periodTiming?.endTime || '09:45 AM';
}

export default function CalendarPage() {
  const { selectedChild } = useParent();
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const getCurrentDayName = () => {
    const dayIdx = new Date().getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const current = dayNames[dayIdx] || 'Monday';
    return current === 'Sunday' ? 'Monday' : current;
  };

  const [activeDay, setActiveDay] = useState<string>(getCurrentDayName);

  const fetchTimetable = async (childId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/parent-portal/children/${childId}/timetable`);
      setTimetable(res.data || []);
    } catch (err) {
      console.error('Failed to fetch timetable:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChild) {
      fetchTimetable(selectedChild.id);
    }
  }, [selectedChild]);

  // Listen to switcher events
  useEffect(() => {
    const handleChildChange = (e: any) => {
      fetchTimetable(e.detail);
    };
    window.addEventListener('parentChildChanged', handleChildChange);
    return () => window.removeEventListener('parentChildChanged', handleChildChange);
  }, []);

  if (!selectedChild) {
    return (
      <div className="text-slate-500 text-sm text-center py-12">
        Please select a child to view timetable.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-t-[#2E5BFF] border-r-[#2E5BFF] border-b-transparent border-l-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const filteredPeriods = timetable
    .filter(p => (p.day || p.dayOfWeek || '').toLowerCase() === activeDay.toLowerCase())
    .sort((a, b) => (a.timingOrder || a.periodNumber || 0) - (b.timingOrder || b.periodNumber || 0));

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in relative">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          Class Schedule: <span className="text-[#2E5BFF] font-extrabold">{selectedChild.name}</span>
        </h2>
        <p className="text-slate-500 text-xs mt-1 font-light">Check weekly period divisions and school timings.</p>
      </div>

      {/* Weekday Switcher tabs */}
      <div className="flex overflow-x-auto gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl scrollbar-none shrink-0 shadow-sm">
        {daysOfWeek.map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeDay === day 
                ? 'bg-[#2E5BFF] text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {day.substring(0, 3)}
          </button>
        ))}
      </div>

      {/* Daily Periods list */}
      <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
          <CalendarIcon className="w-4.5 h-4.5 text-[#2E5BFF]" />
          Timetable for {activeDay}
        </h3>

        {filteredPeriods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center">
            <Info className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-xs font-light">No lectures or periods scheduled for this day.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPeriods.map((period: any) => {
              const isBreak = !!(period.isBreak || period.periodTiming?.isBreak);
              const subjectName = getSubjectName(period);
              const teacherName = getTeacherName(period);
              const startTime = getStartTime(period);
              const endTime = getEndTime(period);

              if (isBreak) {
                return (
                  <div
                    key={period.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl transition-all gap-4 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100/90 flex flex-col items-center justify-center text-amber-700 border border-amber-200/80 shrink-0">
                        <Utensils className="w-4.5 h-4.5 text-amber-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-amber-950">{subjectName}</h4>
                          <span className="px-2 py-0.5 rounded-md bg-amber-200/60 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                            Break
                          </span>
                        </div>
                        <span className="text-[10px] text-amber-700 flex items-center gap-1.5 mt-0.5 font-medium">
                          School Break / Recess Period
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-white/90 border border-amber-200 px-3.5 py-2 rounded-xl self-start sm:self-center shadow-2xs">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{startTime} - {endTime}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={period.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-slate-250 transition-all gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex flex-col items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase leading-none font-bold">Lec</span>
                      <strong className="text-sm font-black text-slate-700 mt-0.5">{period.periodNumber || 1}</strong>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{subjectName}</h4>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5 font-light">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Teacher: {teacherName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 px-3.5 py-2 rounded-xl self-start sm:self-center">
                    <Clock className="w-3.5 h-3.5 text-[#2E5BFF] shrink-0" />
                    <span>{startTime} - {endTime}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
