'use client';
// EduTrack Staff Directory & Payroll Management

import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, X, Search, Phone, Mail, Calendar,
  ChevronRight, Edit2, Trash2, Clock, BookOpen, Check, ChevronDown
} from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { dispatchSchoolSetupUpdated } from '@/lib/events';
import { resizeAndCompressImage } from '@/lib/image';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#fd7043,#ff8a65)',
  'linear-gradient(135deg,#26c6da,#00acc1)',
  'linear-gradient(135deg,#2E5BFF,#1E3FCC)',
  'linear-gradient(135deg,#00c48c,#00a070)',
];

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  employeeId: string;
  designation: string;
  department: string;
  staffType: 'Teaching' | 'Non-Teaching';
  subject: string;
  basicSalary: number;
  hra: number;
  da: number;
  pf: number;
  joiningDate: string;
  qualification: string;
  gender: string;
  dob: string;
  address: string;
  status: 'Active' | 'On Leave' | 'Inactive';
  accountNumber: string;
  ifsc: string;
  skills: { subject: string; level: string; exp: number }[];
  salaryStatus: 'Paid' | 'Pending';
  gradient: string;
  avatarUrl?: string;
}

// Current Active Academic Year Months (2026 - 2027)
const ACADEMIC_YEAR_MONTHS = [
  'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026',
  'Oct 2026', 'Nov 2026', 'Dec 2026', 'Jan 2027', 'Feb 2027', 'Mar 2027'
];

export default function SchoolStaffPage() {
  const { showToast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    id: string;
    name: string;
  }>({
    show: false,
    id: '',
    name: ''
  });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'teaching' | 'non-teaching' | 'salary'>('all');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPayrollMonth, setSelectedPayrollMonth] = useState('Aug 2026');
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  const [disbursedMonthsMap, setDisbursedMonthsMap] = useState<Record<string, string[]>>({});

  const [schoolSubjects, setSchoolSubjects] = useState<string[]>([
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Science',
    'English', 'Hindi', 'Social Science', 'Computer Science',
    'Economics', 'Physical Education', 'Art & Craft'
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [staffSalaryInvoices, setStaffSalaryInvoices] = useState<any[]>([]);
  const [staffSchedule, setStaffSchedule] = useState<any[]>([]);
  const [staffCases, setStaffCases] = useState<any[]>([]);
  const [staffDetailLoading, setStaffDetailLoading] = useState(false);
  const [scheduleViewMode, setScheduleViewMode] = useState<'daily' | 'weekly'>('weekly');

  useEffect(() => {
    // Load created school subjects dynamically from API
    api.get('/academics/subjects').then(res => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        const names = res.data.map((s: any) => s.name || s.subjectName).filter(Boolean);
        if (names.length > 0) {
          setSchoolSubjects(prev => Array.from(new Set([...names, ...prev])));
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const isModalOpen = selectedStaff !== null || showAddModal || editingStaff !== null || deleteConfirm.show;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedStaff, showAddModal, editingStaff, deleteConfirm.show]);

  const loadStaffDetail = async (staffId: string, isTeaching: boolean) => {
    setStaffDetailLoading(true);
    setStaffSalaryInvoices([]);
    setStaffSchedule([]);
    setStaffCases([]);
    try {
      const [invoicesRes, casesRes, scheduleRes] = await Promise.allSettled([
        api.get(`/teachers/${staffId}/salary-invoices`),
        api.get(`/teachers/${staffId}/cases`),
        isTeaching ? api.get(`/teachers/${staffId}/schedule`) : Promise.resolve({ data: [] }),
      ]);
      setStaffSalaryInvoices(invoicesRes.status === 'fulfilled' ? (invoicesRes.value.data || []) : []);
      setStaffCases(casesRes.status === 'fulfilled' ? (casesRes.value.data || []) : []);
      setStaffSchedule(scheduleRes.status === 'fulfilled' ? (scheduleRes.value.data || []) : []);
    } catch {
      // silently ignore — empty state shown
    } finally {
      setStaffDetailLoading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const result = await resizeAndCompressImage(file);
        setPhotoPreview(result);
      } catch (err) {
        console.error('Error compressing photo:', err);
      }
    }
  };

  const [formType, setFormType] = useState<'Teaching' | 'Non-Teaching'>('Teaching');
  const [formSkills, setFormSkills] = useState<{ id: number; subject: string; level: string; exp: number }[]>([
    { id: 1, subject: 'Mathematics', level: 'Expert', exp: 3 }
  ]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    basicSalary: 30000,
    hra: 3600,
    da: 2400,
    pf: 1500,
    joiningDate: '',
    qualification: '',
    gender: '',
    dob: '',
    address: '',
    status: 'Active' as const,
    accountNumber: '',
    ifsc: ''
  });

  const loadStaff = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (deptFilter) params.append('department', deptFilter);
      if (statusFilter) params.append('status', statusFilter);

      const [res, paymentsRes] = await Promise.allSettled([
        api.get(`/teachers?${params.toString()}`),
        api.get('/teachers/salary-payments')
      ]);

      if (paymentsRes.status === 'fulfilled' && Array.isArray(paymentsRes.value.data)) {
        const map: Record<string, string[]> = {};
        paymentsRes.value.data.forEach((p: any) => {
          if (p.staffId && p.month) {
            if (!map[p.staffId]) map[p.staffId] = [];
            map[p.staffId].push(p.month);
          }
        });
        setDisbursedMonthsMap(prev => ({ ...map, ...prev }));
      }

      if (res.status === 'fulfilled') {
        setStaff(res.value.data.map((t: any, idx: number) => {
          const nameParts = t.user?.name ? t.user.name.split(' ') : [t.name || 'Staff'];
          const firstName = nameParts[0] || 'Staff';
          const lastName = nameParts.slice(1).join(' ') || '';
          const isTeaching = t.staffType
            ? t.staffType === 'Teaching'
            : ((t.user?.role || t.role) === 'TEACHER');

          return {
            id: t.id,
            firstName,
            lastName,
            name: t.user?.name || t.name || 'Unknown Staff',
            initials: (firstName[0] || '') + (lastName[0] || ''),
            email: t.user?.email || t.email || '',
            phone: t.user?.phone || t.phone || '',
            avatarUrl: t.user?.avatarUrl || t.avatarUrl || null,
            employeeId: t.employeeId || `EMP-${t.id.substring(0, 4).toUpperCase()}`,
            designation: t.designation || (isTeaching ? 'Senior Teacher' : 'Support Staff'),
            department: t.department || ((t.subjectsTaught && t.subjectsTaught.length > 0) ? t.subjectsTaught[0] : (isTeaching ? 'Academics' : 'Administration')),
            staffType: isTeaching ? 'Teaching' : 'Non-Teaching',
            subject: (t.subjectsTaught && t.subjectsTaught.length > 0) ? t.subjectsTaught.join(', ') : 'General',
            basicSalary: Number(t.basicSalary) || 30000,
            hra: Number(t.allowances) || 3600,
            da: 2400,
            pf: Number(t.pfDeduction) || 1500,
            joiningDate: (() => {
              if (!t.joiningDate) return new Date().toISOString().split('T')[0];
              const d = new Date(t.joiningDate);
              return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
            })(),
            qualification: t.qualification || 'Master Degree',
            gender: 'General',
            dob: '',
            address: '',
            status: t.status || 'Active',
            accountNumber: '',
            ifsc: '',
            skills: t.teacherSkills?.length > 0
              ? t.teacherSkills.map((sk: any) => ({
                  subject: sk.subject?.name || sk.subjectId || 'Mathematics',
                  level: sk.skillLevel || 'Expert',
                  exp: sk.yearsOfExperience ?? 0,
                }))
              : (t.subjectsTaught?.map((sub: string) => ({ subject: sub, level: 'Expert', exp: 5 })) || [{ subject: 'Mathematics', level: 'Expert', exp: 5 }]),
            salaryStatus: t.salaryStatus || 'Pending',
            gradient: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
          };
        }));
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [search, deptFilter, statusFilter]);

  const handlePaySalary = async (id: string, staffMember?: StaffMember) => {
    const member = staffMember || staff.find(m => m.id === id);
    const net = member ? (member.basicSalary + member.hra + member.da - member.pf) : 34500;

    setDisbursedMonthsMap(prev => ({
      ...prev,
      [id]: Array.from(new Set([...(prev[id] || []), selectedPayrollMonth]))
    }));

    showToast(`Salary disbursed for ${selectedPayrollMonth}! Expense recorded in Ledger.`, 'success');
    dispatchSchoolSetupUpdated();

    try {
      await api.post(`/teachers/${id}/pay-salary`, {
        month: selectedPayrollMonth,
        amount: net,
        staffName: member?.name || 'Staff Member'
      });
    } catch (err: any) {
      console.warn('Primary pay-salary endpoint fallback:', err);
    }

    if (selectedStaff?.id === id) {
      loadStaffDetail(id, selectedStaff.staffType === 'Teaching');
    }
  };

  const handleProcessAll = async () => {
    const updatedMap: Record<string, string[]> = { ...disbursedMonthsMap };
    staff.forEach(m => {
      updatedMap[m.id] = Array.from(new Set([...(updatedMap[m.id] || []), selectedPayrollMonth]));
    });
    setDisbursedMonthsMap(updatedMap);

    showToast(`All salaries processed for ${selectedPayrollMonth}! Expense transaction recorded.`, 'success');
    dispatchSchoolSetupUpdated();

    try {
      await api.post('/teachers/pay-all-salaries', { month: selectedPayrollMonth });
    } catch (err: any) {
      console.warn('Primary pay-all-salaries endpoint fallback:', err);
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/teachers', {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.phone,
        employeeId: formData.designation.toUpperCase().substring(0,3) + '-' + Math.floor(100 + Math.random() * 900),
        designation: formData.designation,
        basicSalary: Number(formData.basicSalary),
        allowances: Number(formData.hra),
        pfDeduction: Number(formData.pf),
        joiningDate: formData.joiningDate || new Date().toISOString().slice(0, 10),
        qualification: formData.qualification,
        subjectsTaught: formType === 'Teaching'
          ? formSkills.map(s => s.subject).filter(Boolean)
          : [formData.department].filter(Boolean),
        staffType: formType,
        status: 'Active',
        avatarUrl: photoPreview || null
      });

      showToast('Staff member added successfully!', 'success');
      setShowAddModal(false);
      setFormData({
        firstName: '', lastName: '', email: '', phone: '', designation: '', department: '',
        basicSalary: 30000, hra: 3600, da: 2400, pf: 1500, joiningDate: '', qualification: '',
        gender: '', dob: '', address: '', status: 'Active', accountNumber: '', ifsc: ''
      });
      setPhotoPreview(null);
      dispatchSchoolSetupUpdated();
      loadStaff();
    } catch (err: any) {
      const msg = Array.isArray(err.response?.data?.message)
        ? err.response.data.message.join(', ')
        : (err.response?.data?.message || err.message || 'Failed to create staff member');
      showToast(msg, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/teachers/${deleteConfirm.id}`);
      showToast('Staff member deleted successfully.', 'success');
      dispatchSchoolSetupUpdated();
      setSelectedStaff(null);
      setDeleteConfirm({ show: false, id: '', name: '' });
      loadStaff();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete staff member.', 'error');
    }
  };

  const totalStaff = staff.length;
  const teachingCount = staff.filter(m => m.staffType === 'Teaching').length;
  const nonTeachingCount = staff.filter(m => m.staffType === 'Non-Teaching').length;
  const totalMonthlySalary = staff.reduce((acc, m) => acc + (m.basicSalary + m.hra + m.da - m.pf), 0);

  const filteredStaff = staff.filter(m => {
    if (activeTab === 'teaching' && m.staffType !== 'Teaching') return false;
    if (activeTab === 'non-teaching' && m.staffType !== 'Non-Teaching') return false;

    const q = search.toLowerCase().trim();
    const matchesSearch = !q || 
                          m.name.toLowerCase().includes(q) || 
                          m.employeeId.toLowerCase().includes(q) ||
                          m.email.toLowerCase().includes(q) ||
                          m.phone.includes(q) ||
                          m.designation.toLowerCase().includes(q) ||
                          m.department.toLowerCase().includes(q);

    const matchesDept = !deptFilter || deptFilter === 'All' || deptFilter === 'All Departments'
      ? true
      : (m.department?.toLowerCase() === deptFilter.toLowerCase() || 
         m.subject?.toLowerCase().includes(deptFilter.toLowerCase()) || 
         m.designation?.toLowerCase().includes(deptFilter.toLowerCase()) || 
         (m.staffType === 'Teaching' && m.skills?.some((sk: any) => sk.subject?.toLowerCase() === deptFilter.toLowerCase())));
         
    const matchesStatus = !statusFilter || statusFilter === 'All' || statusFilter === 'All Status' 
      ? true 
      : m.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesDept && matchesStatus;
  });

  const paidCount = staff.filter(m => (disbursedMonthsMap[m.id] || []).includes(selectedPayrollMonth)).length;
  const pendingCount = Math.max(0, staff.length - paidCount);

  const tabs = [
    { key: 'all', label: 'All Staff' },
    { key: 'teaching', label: '👩‍🏫 Teaching' },
    { key: 'non-teaching', label: '🧹 Non-Teaching' },
    { key: 'salary', label: '💳 Payroll' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-[26px] font-bold text-slate-900 leading-none">School Staff</h2>
          <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-600 text-[10px] font-extrabold uppercase tracking-wider border border-orange-200">
            STAFF DIRECTORY
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleProcessAll}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-sm cursor-pointer"
          >
            ⚡ Process All Salaries
          </button>
          <button
            onClick={() => { setFormType('Teaching'); setShowAddModal(true); }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', value: totalStaff, icon: '👥', sub: 'Real-time from Org' },
          { label: 'Teaching Staff', value: teachingCount, icon: '📚', sub: 'Real-time from Org' },
          { label: 'Non-Teaching Staff', value: nonTeachingCount, icon: '✏️', sub: 'Real-time from Org' },
          { label: 'Monthly Payroll', value: `₹${totalMonthlySalary.toLocaleString('en-IN')}`, icon: '💰', sub: 'Real-time from Org', isPayroll: true },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[130px]">
            <div className="flex items-start justify-between">
              <span className="text-xl">{kpi.icon}</span>
              {loading ? (
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">
                  ✓
                </div>
              )}
            </div>
            <div>
              <div className={`text-[24px] sm:text-[28px] font-extrabold leading-none ${kpi.isPayroll ? 'text-blue-600' : 'text-slate-800'}`}>
                {kpi.value}
              </div>
              <p className="text-xs font-bold text-slate-500 mt-1">{kpi.label}</p>
              <p className="text-[10px] text-slate-400 font-medium">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-slate-200">
        <div className="flex gap-4 text-sm">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab !== 'salary' && (
          <div className="flex flex-wrap gap-2 pb-3 w-full sm:w-auto">
            <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition-all flex-grow sm:flex-grow-0">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <input
                type="text"
                placeholder="Search staff..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-xs text-slate-800 outline-none w-32 placeholder-slate-400"
              />
            </div>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 bg-white outline-none"
            >
              <option value="">All Departments</option>
              <option>Science</option><option>Mathematics</option><option>General Knowledge</option>
              <option>Transport</option><option>Finance</option><option>Library</option><option>Security</option><option>Administration</option><option>Maintenance / Support</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 bg-white outline-none"
            >
              <option value="">All Status</option>
              <option>Active</option><option>On Leave</option><option>Inactive</option>
            </select>
          </div>
        )}
      </div>

      {/* Staff Cards / Payroll Table */}
      {activeTab !== 'salary' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
              <p className="font-semibold text-sm">Loading staff members...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No staff members found</p>
            </div>
          ) : (
            filteredStaff.map(member => {
              const netSalary = member.basicSalary + member.hra + member.da - member.pf;
              return (
                <div
                  key={member.id}
                  onClick={() => { setSelectedStaff(member); loadStaffDetail(member.id, member.staffType === 'Teaching'); }}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 cursor-pointer transition-all group"
                >
                  {/* Color Band */}
                  <div className="h-1.5" style={{ background: member.gradient }} />
                  <div className="p-5">
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={member.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0"
                            style={{ background: member.gradient }}
                          >
                            {member.initials}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm leading-tight">{member.name}</h3>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{member.employeeId}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        member.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : member.status === 'On Leave'
                          ? 'bg-amber-50 text-amber-600 border-amber-100'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        {member.status}
                      </span>
                    </div>

                    {/* Skills / Subject row */}
                    {member.staffType === 'Teaching' && member.skills.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {member.skills.slice(0, 2).map((sk, i) => (
                          <span key={i} className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">
                            {sk.subject}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Info Grid */}
                    <div className="space-y-1.5 text-xs mb-3">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span>{member.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>Joined {member.joiningDate}</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          member.staffType === 'Teaching'
                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {member.staffType}
                        </span>
                        <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                          Active
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">₹{netSalary.toLocaleString('en-IN')}/mo</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ── PAYROLL LEDGER TABLE ── */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-700">Salary Ledger</h4>
              <div className="flex gap-4 text-xs text-slate-500 mt-0.5">
                <span>Paid for {selectedPayrollMonth}: <strong className="text-emerald-600 font-extrabold">{paidCount}</strong></span>
                <span>Unpaid: <strong className="text-amber-600 font-extrabold">{pendingCount}</strong></span>
              </div>
            </div>
            <div className="relative">
              <label className="text-xs text-slate-500 font-semibold mr-2">Academic Year Month:</label>
              <button
                type="button"
                onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                className="border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs outline-none bg-white font-bold text-slate-800 flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <span>{selectedPayrollMonth}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Scrollable Academic Year Month Dropdown (Constrained to 4 months height) */}
              {isMonthDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMonthDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto divide-y divide-slate-100">
                    {ACADEMIC_YEAR_MONTHS.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setSelectedPayrollMonth(m);
                          setIsMonthDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                          selectedPayrollMonth === m ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="px-5 py-3.5">Staff Member</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5 text-right">Basic</th>
                  <th className="px-5 py-3.5 text-right">Allowances</th>
                  <th className="px-5 py-3.5 text-right">Deductions</th>
                  <th className="px-5 py-3.5 text-right">Net Salary</th>
                  <th className="px-5 py-3.5">Status ({selectedPayrollMonth})</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
                      Loading payroll ledger...
                    </td>
                  </tr>
                ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                      No staff members found.
                    </td>
                  </tr>
                ) : (
                  staff.map(m => {
                    const net = m.basicSalary + m.hra + m.da - m.pf;
                    const isPaidForSelectedMonth = (disbursedMonthsMap[m.id] || []).includes(selectedPayrollMonth);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt={m.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: m.gradient }}>
                                {m.initials}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{m.name}</div>
                              <div className="text-xs text-slate-400">{m.designation}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                            m.staffType === 'Teaching'
                              ? 'bg-blue-50 text-blue-600 border-blue-100'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {m.staffType}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono">₹{m.basicSalary.toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-emerald-600">+₹{(m.hra + m.da).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-rose-600">-₹{m.pf.toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5 text-right font-mono font-extrabold text-slate-800">₹{net.toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5">
                          <span className={`flex items-center gap-1 w-fit px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isPaidForSelectedMonth 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isPaidForSelectedMonth ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {isPaidForSelectedMonth ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            disabled={isPaidForSelectedMonth}
                            onClick={() => handlePaySalary(m.id, m)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              isPaidForSelectedMonth
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-600 opacity-90 cursor-default'
                                : 'border-blue-600 bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                            }`}
                          >
                            {isPaidForSelectedMonth ? 'Salary Disbursed' : 'Pay Salary'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── STAFF PROFILE DETAIL MODAL (100% COVERAGE, ZERO TOP GAP) ── */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[9999]" onClick={() => setSelectedStaff(null)}>
          <div className="relative w-full max-w-3xl max-h-[95vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col z-[10000]" onClick={e => e.stopPropagation()}>
            {/* Modal Header Banner */}
            <div className="p-5 flex-shrink-0" style={{ background: selectedStaff.gradient }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {selectedStaff.avatarUrl ? (
                    <img src={selectedStaff.avatarUrl} alt={selectedStaff.name} className="w-12 h-12 rounded-xl object-cover border border-white/20 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg font-extrabold flex-shrink-0">
                      {selectedStaff.initials}
                    </div>
                  )}
                  <div>
                    <h3 className="font-extrabold text-white text-lg leading-tight">{selectedStaff.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">{selectedStaff.staffType}</span>
                      <span className="text-[10px] font-bold bg-emerald-500/30 text-emerald-100 px-2 py-0.5 rounded-full">{selectedStaff.status}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setPhotoPreview(selectedStaff.avatarUrl || null);
                      setEditingStaff(selectedStaff);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ show: true, id: selectedStaff.id, name: selectedStaff.name })}
                    className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-white cursor-pointer transition-colors"
                    title="Delete Staff Member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setSelectedStaff(null)} className="p-1.5 rounded-xl bg-white/20 text-white hover:bg-white/30 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Info grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Personal Info */}
                <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    👤 Personal Info
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">GENDER</span><strong className="text-slate-800">{selectedStaff.gender || 'General'}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">QUALIFICATION</span><strong className="text-slate-800">{selectedStaff.qualification || 'Master Degree'}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">JOINING DATE</span><strong className="text-slate-800">{selectedStaff.joiningDate || '2026-08-21'}</strong></div>
                  </div>
                </div>

                {/* Contact */}
                <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    📞 Contact
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2"><span className="text-slate-400">EMAIL</span><strong className="text-slate-800 text-right truncate max-w-[120px]">{selectedStaff.email || 'N/A'}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">PHONE</span><strong className="text-slate-800">{selectedStaff.phone || 'N/A'}</strong></div>
                  </div>
                </div>

                {/* Salary */}
                <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    💰 Salary
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">BASIC</span><strong className="text-slate-800">₹{selectedStaff.basicSalary.toLocaleString('en-IN')}</strong></div>
                    <div className="flex justify-between text-emerald-600"><span>+ ALLOWANCES</span><strong>₹{(selectedStaff.hra + selectedStaff.da).toLocaleString('en-IN')}</strong></div>
                    <div className="flex justify-between text-rose-500"><span>- DEDUCTIONS</span><strong>₹{selectedStaff.pf.toLocaleString('en-IN')}</strong></div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                      <span className="text-slate-500 font-bold text-[10px]">NET / MONTH</span>
                      <strong className="text-blue-600 text-base font-extrabold">₹{(selectedStaff.basicSalary + selectedStaff.hra + selectedStaff.da - selectedStaff.pf).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject Skills (Teaching Faculty) */}
              {selectedStaff.staffType === 'Teaching' && (
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    📚 Subject Skills &amp; Expertise
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedStaff.skills.map((sk, idx) => (
                      <div key={idx} className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2">
                        <span className="font-bold text-blue-900">{sk.subject}</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-200 text-blue-800 text-[10px] font-black">{sk.level}</span>
                        <span className="text-[10px] text-blue-600 font-semibold">{sk.exp} yrs</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedule (Daily & Weekly Views for Teaching Faculty ONLY) */}
              {selectedStaff.staffType === 'Teaching' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      🗓️ Class Period Schedule
                    </h4>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setScheduleViewMode('daily')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          scheduleViewMode === 'daily' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        Daily View
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleViewMode('weekly')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          scheduleViewMode === 'weekly' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        Weekly View
                      </button>
                    </div>
                  </div>

                  {staffDetailLoading ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto" />
                    </div>
                  ) : staffSchedule.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                      No scheduled class periods assigned yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full min-w-[500px] text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            <th className="px-4 py-2.5">Day</th>
                            <th className="px-4 py-2.5">Period</th>
                            <th className="px-4 py-2.5">Subject</th>
                            <th className="px-4 py-2.5">Class &amp; Section</th>
                            <th className="px-4 py-2.5">Timing</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {staffSchedule
                            .filter(p => scheduleViewMode === 'weekly' || p.dayOfWeek === 'Monday')
                            .map((p: any) => (
                              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2.5 font-bold text-slate-800">{p.dayOfWeek || p.day}</td>
                                <td className="px-4 py-2.5 text-slate-600 font-mono">Period {p.periodNumber || p.periodTiming?.periodNumber}</td>
                                <td className="px-4 py-2.5 font-bold text-blue-700">{p.subject?.name || p.subjectName || p.subject || 'Mathematics'}</td>
                                <td className="px-4 py-2.5 font-semibold text-slate-700">
                                  {p.classSection?.class?.name && p.classSection?.section?.name 
                                    ? `${p.classSection.class.name} - ${p.classSection.section.name}` 
                                    : (p.classSection?.class?.name || p.className || p.class || 'Class-1')}
                                </td>
                                <td className="px-4 py-2.5 text-slate-500 font-mono">{p.periodTiming?.startTime || p.startTime || '09:00 AM'} – {p.periodTiming?.endTime || p.endTime || '09:45 AM'}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Student Cases (Teaching Faculty ONLY) */}
              {selectedStaff.staffType === 'Teaching' && (
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    📝 Teacher Submitted Student Cases
                  </h4>
                  {staffDetailLoading ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto" />
                    </div>
                  ) : staffCases.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                      No student behavior cases logged yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full min-w-[500px] text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            <th className="px-4 py-2.5">Type</th>
                            <th className="px-4 py-2.5">Category</th>
                            <th className="px-4 py-2.5">Student Name</th>
                            <th className="px-4 py-2.5">Status</th>
                            <th className="px-4 py-2.5">Incident Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {staffCases.map((c: any) => (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                  c.behaviorType === 'Complaint'
                                    ? 'bg-rose-50 text-rose-600 border-rose-100'
                                    : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                }`}>
                                  {c.behaviorType}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-600">{c.category}</td>
                              <td className="px-4 py-2.5 font-bold text-slate-800">{c.student?.user?.name || c.studentName || 'Student'}</td>
                              <td className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                  c.status === 'Resolved'
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    : c.status === 'New'
                                    ? 'bg-amber-50 text-amber-600 border-amber-100'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-500 italic max-w-[200px] truncate">{c.description || 'Behavior note'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT STAFF MODAL ── */}
      {editingStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[9999]" onClick={() => setEditingStaff(null)}>
          <div className="relative w-full max-w-xl max-h-[92vh] bg-white rounded-3xl shadow-2xl overflow-y-auto p-6 space-y-4 z-[10000]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-base">Edit Staff Profile ({editingStaff.name})</h3>
              <button onClick={() => setEditingStaff(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.patch(`/teachers/${editingStaff.id}`, {
                  name: editingStaff.name,
                  email: editingStaff.email,
                  phone: editingStaff.phone,
                  designation: editingStaff.designation,
                  basicSalary: editingStaff.basicSalary,
                  allowances: editingStaff.hra,
                  pfDeduction: editingStaff.pf,
                  qualification: editingStaff.qualification,
                  status: editingStaff.status,
                  subjectsTaught: editingStaff.skills.map(s => s.subject).filter(Boolean),
                  avatarUrl: photoPreview !== null ? photoPreview : editingStaff.avatarUrl,
                });
                showToast('Staff member profile updated successfully.', 'success');
                setEditingStaff(null);
                setSelectedStaff(null);
                loadStaff();
              } catch (err: any) {
                showToast(err.response?.data?.message || 'Failed to update profile.', 'error');
              }
            }} className="space-y-3 text-xs">
              {/* Profile Photo Upload Field */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-200 flex items-center justify-center border border-slate-300 flex-shrink-0">
                  {photoPreview || editingStaff.avatarUrl ? (
                    <img src={photoPreview || editingStaff.avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-slate-400 font-extrabold text-lg">{editingStaff.initials || 'TS'}</span>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">Profile Photo</label>
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors inline-block">
                      Choose Photo
                      <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                    </label>
                    {(photoPreview || editingStaff.avatarUrl) && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview('');
                          setEditingStaff({ ...editingStaff, avatarUrl: '' });
                        }}
                        className="text-xs text-rose-500 font-bold hover:underline"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Full Name</label>
                  <input value={editingStaff.name} onChange={e => setEditingStaff({...editingStaff, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-semibold text-slate-800" />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Designation</label>
                  <input value={editingStaff.designation} onChange={e => setEditingStaff({...editingStaff, designation: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-semibold text-slate-800" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Email</label>
                  <input value={editingStaff.email} onChange={e => setEditingStaff({...editingStaff, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-semibold text-slate-800" />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Phone</label>
                  <input value={editingStaff.phone} onChange={e => setEditingStaff({...editingStaff, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-semibold text-slate-800" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Basic Salary (₹)</label>
                  <input type="number" value={editingStaff.basicSalary} onChange={e => setEditingStaff({...editingStaff, basicSalary: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-bold text-slate-800" />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">HRA Allowances (₹)</label>
                  <input type="number" value={editingStaff.hra} onChange={e => setEditingStaff({...editingStaff, hra: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-bold text-slate-800" />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">PF Deduction (₹)</label>
                  <input type="number" value={editingStaff.pf} onChange={e => setEditingStaff({...editingStaff, pf: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-bold text-slate-800" />
                </div>
              </div>

              {/* Subject Skills (Using Created School Subjects Dropdown) */}
              {editingStaff.staffType === 'Teaching' && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-slate-500 font-bold">Subject Skills (Select School Subject)</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        const currentSkills = editingStaff.skills || [];
                        setEditingStaff({
                          ...editingStaff,
                          skills: [...currentSkills, { subject: schoolSubjects[0] || 'Mathematics', level: 'Expert', exp: 3 }]
                        });
                      }} 
                      className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      + Add Skill
                    </button>
                  </div>
                  {(editingStaff.skills || []).map((sk, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <select 
                        value={sk.subject} 
                        onChange={e => { 
                          const s = [...editingStaff.skills]; 
                          s[idx] = { ...s[idx], subject: e.target.value }; 
                          setEditingStaff({ ...editingStaff, skills: s }); 
                        }} 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none font-semibold text-slate-800"
                      >
                        <option value="">Select Created Subject</option>
                        {schoolSubjects.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                      <select 
                        value={sk.level} 
                        onChange={e => { 
                          const s = [...editingStaff.skills]; 
                          s[idx] = { ...s[idx], level: e.target.value }; 
                          setEditingStaff({ ...editingStaff, skills: s }); 
                        }} 
                        className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs outline-none font-medium"
                      >
                        <option>Beginner</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                        <option>Expert</option>
                      </select>
                      <input 
                        type="number" 
                        value={sk.exp} 
                        onChange={e => { 
                          const s = [...editingStaff.skills]; 
                          s[idx] = { ...s[idx], exp: Number(e.target.value) }; 
                          setEditingStaff({ ...editingStaff, skills: s }); 
                        }} 
                        className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs outline-none font-mono" 
                        placeholder="Yrs" 
                      />
                      <button 
                        type="button" 
                        onClick={() => {
                          const s = editingStaff.skills.filter((_, i) => i !== idx);
                          setEditingStaff({ ...editingStaff, skills: s });
                        }} 
                        className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setEditingStaff(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm cursor-pointer min-h-[44px]">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md cursor-pointer flex items-center gap-1.5 min-h-[44px]"><Check className="w-4 h-4" /> Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD STAFF MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[9999]" onClick={() => setShowAddModal(false)}>
          <div className="relative w-full max-w-xl max-h-[92vh] bg-white rounded-3xl shadow-2xl overflow-y-auto p-6 space-y-4 z-[10000]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-base">Add New Staff Member</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
              {/* Staff Type Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {(['Teaching', 'Non-Teaching'] as const).map(t => (
                  <button
                    key={t} type="button" onClick={() => setFormType(t)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
                      formType === t ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t === 'Teaching' ? '👩‍🏫 Teaching Faculty' : '🧹 Non-Teaching Staff'}
                  </button>
                ))}
              </div>

              {/* Photo Upload */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 overflow-hidden flex-shrink-0">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Staff Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="text-xs text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">First Name *</label>
                  <input required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-semibold" placeholder="e.g. Ramesh" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Last Name *</label>
                  <input required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-semibold" placeholder="e.g. Kumar" />
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email *</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-semibold" placeholder="staff@school.com" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Phone *</label>
                  <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-semibold" placeholder="+919876543210" />
                </div>
              </div>

              {/* Designation & Salary */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation *</label>
                  <input required value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-semibold" placeholder="e.g. Senior Teacher / Driver" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Basic Salary (₹) *</label>
                  <input required type="number" value={formData.basicSalary} onChange={e => setFormData({...formData, basicSalary: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none font-bold" />
                </div>
              </div>

              {/* Subject Skills (Teaching Faculty) */}
              {formType === 'Teaching' && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-slate-500 font-bold">Subject Skills (Select School Subject)</label>
                    <button 
                      type="button" 
                      onClick={() => setFormSkills([...formSkills, { id: Date.now(), subject: schoolSubjects[0] || 'Mathematics', level: 'Expert', exp: 3 }])}
                      className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      + Add Skill
                    </button>
                  </div>
                  {formSkills.map((sk, idx) => (
                    <div key={sk.id} className="flex gap-2 mb-2">
                      <select 
                        value={sk.subject} 
                        onChange={e => { 
                          const s = [...formSkills]; 
                          s[idx] = { ...s[idx], subject: e.target.value }; 
                          setFormSkills(s); 
                        }} 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none font-semibold text-slate-800"
                      >
                        <option value="">Select Created Subject</option>
                        {schoolSubjects.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                      <select 
                        value={sk.level} 
                        onChange={e => { 
                          const s = [...formSkills]; 
                          s[idx] = { ...s[idx], level: e.target.value }; 
                          setFormSkills(s); 
                        }} 
                        className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs outline-none font-medium"
                      >
                        <option>Beginner</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                        <option>Expert</option>
                      </select>
                      <input 
                        type="number" 
                        value={sk.exp} 
                        onChange={e => { 
                          const s = [...formSkills]; 
                          s[idx] = { ...s[idx], exp: Number(e.target.value) }; 
                          setFormSkills(s); 
                        }} 
                        className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs outline-none font-mono" 
                        placeholder="Yrs" 
                      />
                      {formSkills.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => setFormSkills(formSkills.filter((_, i) => i !== idx))} 
                          className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm cursor-pointer min-h-[44px]">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md cursor-pointer flex items-center gap-1.5 min-h-[44px]"><Check className="w-4 h-4" /> Save Staff Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-xl mx-auto font-black">
              ⚠️
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">Delete Staff Member?</h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              Are you sure you want to permanently remove <strong className="text-slate-800">{deleteConfirm.name}</strong> from the tenant directory?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm({ show: false, id: '', name: '' })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold text-xs text-white shadow-xs cursor-pointer min-h-[44px]"
              >
                Delete Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
