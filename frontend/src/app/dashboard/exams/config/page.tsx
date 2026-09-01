'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  Settings2, Plus, Trash2, Save, CheckCircle, AlertCircle,
  ChevronDown, GraduationCap, BarChart3, Info, X, ChevronRight, Calculator
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface GradeRange {
  min: number;
  max: number;
  grade: string;
  gpa: number;
  label: string;
}

interface ExamConfigSubject {
  id?: string;
  subjectId: string;
  subjectType: string;
  maxMarks: number;
  passMarks?: number | null;
  passingPercentage: number;
  remarks?: string;
}

interface ExamConfigEntry {
  id: string;
  examTypeName: string | null;
  isGlobal: boolean;
  passingPercentage: number;
  maxMarks: number;
  gradeRanges: GradeRange[];
  academicYearId?: string;
  classId?: string;
  className?: string;
  subjectConfigs?: ExamConfigSubject[];
  updatedAt: string;
}

const DEFAULT_GRADE_RANGES: GradeRange[] = [
  { min: 90, max: 100, grade: 'A+', gpa: 10, label: 'Outstanding' },
  { min: 80, max: 89,  grade: 'A',  gpa: 9,  label: 'Excellent'   },
  { min: 70, max: 79,  grade: 'B+', gpa: 8,  label: 'Very Good'   },
  { min: 60, max: 69,  grade: 'B',  gpa: 7,  label: 'Good'        },
  { min: 50, max: 59,  grade: 'C',  gpa: 6,  label: 'Average'     },
  { min: 35, max: 49,  grade: 'D',  gpa: 5,  label: 'Below Avg'   },
  { min: 0,  max: 34,  grade: 'F',  gpa: 0,  label: 'Fail'        },
];

export default function ExamConfigPage() {
  const [configs, setConfigs] = useState<ExamConfigEntry[]>([]);
  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [overrideData, setOverrideData] = useState<{
    academicYearId: string;
    classId: string;
    examTypeName: string;
    subjectConfigs: ExamConfigSubject[];
  }>({
    academicYearId: '',
    classId: '',
    examTypeName: '',
    subjectConfigs: [],
  });
  
  const [saving, setSaving] = useState(false);
  const [newComponent, setNewComponent] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [cfgRes, typeRes, compRes, ayRes, classRes, subRes] = await Promise.all([
        api.get('/exam-config'),
        api.get('/exams/exam-types'),
        api.get('/exam-config/components'),
        api.get('/academics/academic-years'),
        api.get('/academics/classes'),
        api.get('/academics/subjects'),
      ]);
      setConfigs(cfgRes.data);
      setExamTypes(typeRes.data);
      setComponents(compRes.data);
      setAcademicYears(ayRes.data);
      setClasses(classRes.data);
      setSubjects(subRes.data);
    } catch (err) {
      console.error('Failed to load exam config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Handle auto-populating subject configs when Academic Year, Class, and Exam Type are selected
  useEffect(() => {
    if (showAddOverride && overrideData.academicYearId && overrideData.classId && overrideData.examTypeName && overrideData.subjectConfigs.length === 0) {
      // Find global config passing percentage
      const globalCfg = configs.find(c => c.isGlobal);
      const passPct = globalCfg ? globalCfg.passingPercentage : 35;
      const maxM = globalCfg ? globalCfg.maxMarks : 100;
      const calcPassM = Math.round((passPct / 100) * maxM);

      // We populate all subjects in the system as default.
      // In a more complex setup, we'd fetch subjects assigned to this specific class.
      const initialConfigs = subjects.map(s => ({
        subjectId: s.id,
        subjectType: 'Theory',
        maxMarks: maxM,
        passingPercentage: passPct,
        passMarks: calcPassM,
      }));
      setOverrideData(prev => ({ ...prev, subjectConfigs: initialConfigs }));
    }
  }, [overrideData.academicYearId, overrideData.classId, overrideData.examTypeName, showAddOverride, subjects, configs]);

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComponent.trim()) return;
    try {
      await api.post('/exam-config/components', { name: newComponent.trim() });
      setNewComponent('');
      await fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add component');
    }
  };

  const handleDeleteComponent = async (id: string) => {
    if (!confirm('Delete this subject component type?')) return;
    try {
      await api.delete(`/exam-config/components/${id}`);
      await fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete component');
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Delete this configuration?')) return;
    try {
      await api.delete(`/exam-config/${id}`);
      await fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete config');
    }
  };

  const handleSaveOverride = async () => {
    if (!overrideData.examTypeName) return alert('Please select Exam Type');
    
    // Validate subject configs
    if (overrideData.academicYearId && overrideData.classId) {
      if (overrideData.subjectConfigs.length === 0) return alert('No subjects configured.');
    }

    setSaving(true);
    try {
      await api.post('/exam-config', {
        examTypeName: overrideData.examTypeName,
        passingPercentage: 35, // Global default, class overrides use subject level
        maxMarks: 100,
        gradeRanges: null, // Inherits global
        classId: overrideData.classId || undefined,
        academicYearId: overrideData.academicYearId || undefined,
        subjectConfigs: overrideData.subjectConfigs,
      });
      setShowAddOverride(false);
      setOverrideData({
        academicYearId: '',
        classId: '',
        examTypeName: '',
        subjectConfigs: [],
      });
      await fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateSubjectConfig = (idx: number, field: keyof ExamConfigSubject, val: number | string) => {
    setOverrideData(prev => {
      const next = [...prev.subjectConfigs];
      const row = { ...next[idx] };
      (row as any)[field] = val;

      // Auto calculate Pass Marks if Passing Percentage changes
      if (field === 'passingPercentage') {
        const p = Number(val) || 0;
        row.passMarks = Number(((p / 100) * row.maxMarks).toFixed(2));
      }
      
      // Auto calculate Passing Percentage if Pass Marks changes
      if (field === 'passMarks') {
        const pm = Number(val) || 0;
        if (row.maxMarks > 0) {
          row.passingPercentage = Number(((pm / row.maxMarks) * 100).toFixed(2));
        }
      }

      // Re-calculate Pass Marks if Max Marks changes
      if (field === 'maxMarks') {
        const m = Number(val) || 0;
        row.passMarks = Number(((row.passingPercentage / 100) * m).toFixed(2));
      }

      next[idx] = row;
      return { ...prev, subjectConfigs: next };
    });
  };

  const addSubjectComponent = (subjectId: string) => {
    setOverrideData(prev => {
      const next = [...prev.subjectConfigs];
      // Insert after the last component for this subject
      const lastIdx = next.map(x => x.subjectId).lastIndexOf(subjectId);
      next.splice(lastIdx + 1, 0, {
        subjectId,
        subjectType: 'Practical', // Default new component
        maxMarks: 25,
        passingPercentage: 35,
        passMarks: 8.75,
      });
      return { ...prev, subjectConfigs: next };
    });
  };

  const removeSubjectComponent = (idx: number) => {
    setOverrideData(prev => {
      const next = [...prev.subjectConfigs];
      next.splice(idx, 1);
      return { ...prev, subjectConfigs: next };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-[#2E5BFF] border-b-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const globalEntry = configs.find(c => c.isGlobal);
  const classSpecific = configs.filter(c => c.classId);

  return (
    <div className="space-y-6 max-w-5xl animate-in">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-[28px] font-bold text-slate-900 flex items-center gap-2">
            <Settings2 className="w-7 h-7 text-[#2E5BFF]" />
            Exam Configuration
          </h2>
          <p className="text-slate-500 text-[13px] mt-2">
            Configure examination rules, pass marks, and grade ranges globally or per class.
          </p>
        </div>
        <button
          onClick={() => setShowAddOverride(true)}
          className="px-5 py-2.5 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Class Template
        </button>
      </div>

      {/* Global Config */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Global Default</h3>
        {globalEntry ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="bg-blue-100 text-blue-700 font-bold text-xs px-2.5 py-1 rounded-md">Global Exam Config</span>
                <div className="flex gap-4 mt-3 text-sm text-slate-600 font-medium">
                  <div>Max Marks: <strong className="text-slate-900">{globalEntry.maxMarks}</strong></div>
                  <div>Passing: <strong className="text-slate-900">{globalEntry.passingPercentage}%</strong></div>
                </div>
              </div>
              <button
                onClick={() => handleDeleteConfig(globalEntry.id)}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 text-center">
            <p className="text-sm text-slate-500">No global config. Defaults to 35% pass, 100 max marks.</p>
            <button
              onClick={() => api.post('/exam-config', { examTypeName: null, passingPercentage: 35, maxMarks: 100 }).then(fetchAll)}
              className="mt-3 px-4 py-2 bg-blue-100 text-blue-700 text-xs font-bold rounded-xl cursor-pointer hover:bg-blue-200"
            >
              Create Global Config
            </button>
          </div>
        )}
      </div>

      {/* Class Specific Configs */}
      {classSpecific.length > 0 && (
        <div className="space-y-2 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Class Templates</h3>
          <div className="grid gap-4">
            {classSpecific.map(c => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-indigo-500" />
                      {c.className} <ChevronRight className="w-4 h-4 text-slate-400" /> {c.examTypeName}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">{c.subjectConfigs?.length} subject components configured</p>
                  </div>
                  <button
                    onClick={() => handleDeleteConfig(c.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Class Template Modal */}
      {showAddOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">Add Class Exam Template</h3>
              <button onClick={() => setShowAddOverride(false)} className="p-2 hover:bg-slate-100 rounded-full cursor-pointer text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Selectors */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Academic Year</label>
                  <select 
                    value={overrideData.academicYearId}
                    onChange={e => setOverrideData({...overrideData, academicYearId: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#2E5BFF]"
                  >
                    <option value="">Select Year...</option>
                    {academicYears.map(ay => (
                      <option key={ay.id} value={ay.id}>{ay.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Class</label>
                  <select 
                    value={overrideData.classId}
                    onChange={e => setOverrideData({...overrideData, classId: e.target.value})}
                    disabled={!overrideData.academicYearId}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#2E5BFF] disabled:opacity-50"
                  >
                    <option value="">Select Class...</option>
                    {classes.filter(c => c.academicYearId === overrideData.academicYearId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Exam Type</label>
                  <select 
                    value={overrideData.examTypeName}
                    onChange={e => setOverrideData({...overrideData, examTypeName: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#2E5BFF]"
                  >
                    <option value="">Select Exam Type...</option>
                    {examTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject Grid */}
              {overrideData.subjectConfigs.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 text-lg">Subject-wise Marking Scheme</h4>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                      Auto-calculates pass marks/percentages
                    </span>
                  </div>
                  
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="p-3 border-b border-slate-200">Subject</th>
                          <th className="p-3 border-b border-slate-200">Component</th>
                          <th className="p-3 border-b border-slate-200 w-24">Max Marks</th>
                          <th className="p-3 border-b border-slate-200 w-24">Pass Pct (%)</th>
                          <th className="p-3 border-b border-slate-200 w-24">Pass Marks</th>
                          <th className="p-3 border-b border-slate-200 w-12 text-center">Act</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overrideData.subjectConfigs.map((cfg, idx) => {
                          const subject = subjects.find(s => s.id === cfg.subjectId);
                          // Determine if this is the first component of a subject to render subject name & Add button
                          const isFirstOfSubject = overrideData.subjectConfigs.findIndex(x => x.subjectId === cfg.subjectId) === idx;
                          
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="p-3 border-b border-slate-100">
                                {isFirstOfSubject && (
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-slate-700">{subject?.name}</span>
                                    <button 
                                      onClick={() => addSubjectComponent(cfg.subjectId)}
                                      title="Add Component"
                                      className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="p-3 border-b border-slate-100">
                                <select 
                                  value={cfg.subjectType}
                                  onChange={e => updateSubjectConfig(idx, 'subjectType', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold outline-none focus:border-blue-400"
                                >
                                  <option value="Theory">Theory</option>
                                  {components.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                              </td>
                              <td className="p-3 border-b border-slate-100">
                                <input 
                                  type="number" min={1}
                                  value={cfg.maxMarks || ''}
                                  onChange={e => updateSubjectConfig(idx, 'maxMarks', e.target.value ? Number(e.target.value) : 0)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-400"
                                />
                              </td>
                              <td className="p-3 border-b border-slate-100">
                                <input 
                                  type="number" min={0} max={100} step="0.01"
                                  value={cfg.passingPercentage || ''}
                                  onChange={e => updateSubjectConfig(idx, 'passingPercentage', e.target.value ? Number(e.target.value) : 0)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-400"
                                />
                              </td>
                              <td className="p-3 border-b border-slate-100">
                                <input 
                                  type="number" min={0} step="0.01"
                                  value={cfg.passMarks === null || cfg.passMarks === undefined ? '' : cfg.passMarks}
                                  onChange={e => updateSubjectConfig(idx, 'passMarks', e.target.value ? Number(e.target.value) : 0)}
                                  className="w-full bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 text-xs font-bold text-blue-900 outline-none focus:border-blue-500"
                                />
                              </td>
                              <td className="p-3 border-b border-slate-100 text-center">
                                {!isFirstOfSubject && (
                                  <button onClick={() => removeSubjectComponent(idx)} className="p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded cursor-pointer">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-3xl">
              <button 
                onClick={() => setShowAddOverride(false)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveOverride}
                disabled={saving || overrideData.subjectConfigs.length === 0}
                className="px-6 py-2.5 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Component Management */}
      <div className="space-y-4 pt-6 mt-6 border-t border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Subject Component Types</h3>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Define custom components (e.g. Practical, Viva, Lab) to apply different passing criteria within the same subject. "Theory" is always included by default.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-sm">
          <form onSubmit={handleAddComponent} className="flex gap-3">
            <input 
              type="text" 
              placeholder="e.g. Practical"
              value={newComponent}
              onChange={e => setNewComponent(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-[#2E5BFF]"
            />
            <button type="submit" disabled={!newComponent.trim()} className="px-5 py-2.5 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-sm">
              Add Component
            </button>
          </form>

          {components.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {components.map(comp => (
                <div key={comp.id} className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-xs font-bold text-slate-700">{comp.name}</span>
                  <button onClick={() => handleDeleteComponent(comp.id)} className="p-1 hover:bg-rose-100 rounded-md text-slate-400 hover:text-rose-600 cursor-pointer transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
