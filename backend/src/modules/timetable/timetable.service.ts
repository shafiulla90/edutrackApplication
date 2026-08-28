import { Injectable, Inject, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { FirebaseService } from '../../database/firebase.service';
import { IAcademicRepository } from '../../common/interfaces/academic.repository.interface';
import { IUserRepository } from '../../common/interfaces/user.repository.interface';
import { ITeacherRepository } from '../../common/interfaces/teacher.repository.interface';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TimetableService {
  private readonly prisma?: any;
  constructor(
    @Inject('IAcademicRepository') private readonly academicRepo: IAcademicRepository,
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('ITeacherRepository') private readonly teacherRepo: ITeacherRepository,
    @Optional() private readonly firebase?: FirebaseService,
  ) {}

  // ACADEMIC YEARS
  async getAcademicYears(tenantId: string) {
    return this.academicRepo.findAcademicYears(tenantId);
  }

  // CLASSES
  async getClasses(tenantId: string) {
    return this.academicRepo.findClasses(tenantId);
  }

  async createClass(tenantId: string, name: string) {
    if (!name) throw new BadRequestException('Class Name is required.');
    return this.academicRepo.createClass({
      name: name.trim(),
      tenantId,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }

  async deleteClass(tenantId: string, classId: string) {
    return this.academicRepo.deleteClass(classId);
  }

  // SECTIONS
  async getSections(tenantId: string) {
    return this.academicRepo.findSections(tenantId);
  }

  async createSection(tenantId: string, name: string) {
    if (!name) throw new BadRequestException('Section Name is required.');
    return this.academicRepo.createSection({
      name: name.trim(),
      tenantId,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }

  async deleteSection(tenantId: string, sectionId: string) {
    if (true) {
      return this.academicRepo.deleteSection ? (this.academicRepo as any).deleteSection(sectionId, tenantId) : { id: sectionId };
    }
    const linked = await this.prisma.classSection.findFirst({
      where: { sectionId },
    });
    if (linked) {
      throw new BadRequestException('Cannot delete this section because it is linked to one or more class sections.');
    }

    return this.prisma.section.delete({
      where: { id: sectionId },
    });
  }

  // PERIOD TIMINGS
  async getPeriodTimings(tenantId: string) {
    if (true) {
      try {
        const db = this.firebase?.getFirestore();
        if (!db) return [];
        const snap = await db.collection('tenants').doc(tenantId).collection('periodTimings').orderBy('periodNumber', 'asc').get();
        const list = snap.docs.map((doc) => {
          const pt: any = { id: doc.id, ...doc.data() };
          return {
            id: pt.id,
            num: pt.periodNumber,
            periodNumber: pt.periodNumber,
            label: `Period ${pt.periodNumber}`,
            startTime: pt.startTime,
            endTime: pt.endTime,
            timeLabel: `${pt.startTime}${pt.endTime ? ' – ' + pt.endTime : ''}`,
          };
        });

        if (list.length > 0) return list;

        // Default 8 Period timings fallback
        return [
          { id: 'pt-1', num: 1, periodNumber: 1, label: 'Period 1', startTime: '09:00 AM', endTime: '09:45 AM', timeLabel: '09:00 AM – 09:45 AM' },
          { id: 'pt-2', num: 2, periodNumber: 2, label: 'Period 2', startTime: '09:45 AM', endTime: '10:30 AM', timeLabel: '09:45 AM – 10:30 AM' },
          { id: 'pt-3', num: 3, periodNumber: 3, label: 'Period 3', startTime: '10:30 AM', endTime: '11:15 AM', timeLabel: '10:30 AM – 11:15 AM' },
          { id: 'pt-4', num: 4, periodNumber: 4, label: 'Period 4', startTime: '11:15 AM', endTime: '12:00 PM', timeLabel: '11:15 AM – 12:00 PM' },
          { id: 'pt-5', num: 5, periodNumber: 5, label: 'Period 5', startTime: '12:45 PM', endTime: '01:30 PM', timeLabel: '12:45 PM – 01:30 PM' },
          { id: 'pt-6', num: 6, periodNumber: 6, label: 'Period 6', startTime: '01:30 PM', endTime: '02:15 PM', timeLabel: '01:30 PM – 02:15 PM' },
          { id: 'pt-7', num: 7, periodNumber: 7, label: 'Period 7', startTime: '02:15 PM', endTime: '03:00 PM', timeLabel: '02:15 PM – 03:00 PM' },
          { id: 'pt-8', num: 8, periodNumber: 8, label: 'Period 8', startTime: '03:00 PM', endTime: '03:45 PM', timeLabel: '03:00 PM – 03:45 PM' },
        ];
      } catch (err) {
        console.error('Firebase getPeriodTimings error:', err);
        return [];
      }
    }
    return [];
  }

  async savePeriodTimings(tenantId: string, timings: any[]) {
    // Validate inputs
    for (const t of timings) {
      if (!t.periodNumber || !t.startTime || !t.endTime) {
        throw new BadRequestException('Invalid period timing data');
      }
    }

    if (process.env.DB_PROVIDER === 'firebase' && this.firebase) {
      const db = this.firebase.getFirestore();
      const batch = db.batch();
      const colRef = db.collection('tenants').doc(tenantId).collection('periodTimings');
      
      const existingSnap = await colRef.get();
      const incomingIds = timings.filter(t => t.id).map(t => t.id);
      
      existingSnap.docs.forEach((doc) => {
        if (!incomingIds.includes(doc.id)) {
          batch.delete(doc.ref);
        }
      });

      const results = [];
      for (const t of timings) {
        const id = t.id || randomUUID();
        const ref = colRef.doc(id);
        const payload = {
          id,
          tenantId,
          periodNumber: Number(t.periodNumber),
          startTime: t.startTime,
          endTime: t.endTime,
          isActive: true,
          updatedAt: new Date().toISOString(),
        };
        batch.set(ref, payload, { merge: true });
        results.push({
          id,
          num: Number(t.periodNumber),
          periodNumber: Number(t.periodNumber),
          label: `Period ${t.periodNumber}`,
          startTime: t.startTime,
          endTime: t.endTime,
          timeLabel: `${t.startTime}${t.endTime ? ' – ' + t.endTime : ''}`,
        });
      }
      await batch.commit();
      return results;
    }

    // Wrap in a transaction
    return this.prisma.$transaction(async (tx) => {
      // Find existing timings to update or delete
      const existing = await tx.periodTiming.findMany({
        where: { tenantId },
      });

      const incomingIds = timings.filter(t => t.id).map(t => t.id);
      const toDelete = existing.filter(e => !incomingIds.includes(e.id));

      // Delete removed timings
      if (toDelete.length > 0) {
        await tx.periodTiming.deleteMany({
          where: { id: { in: toDelete.map(d => d.id) } },
        });
      }

      // Upsert timings
      const results = [];
      for (const t of timings) {
        if (t.id) {
          results.push(
            await tx.periodTiming.update({
              where: { id: t.id },
              data: {
                periodNumber: Number(t.periodNumber),
                startTime: t.startTime,
                endTime: t.endTime,
              },
            }),
          );
        } else {
          results.push(
            await tx.periodTiming.create({
              data: {
                id: randomUUID(),
                tenantId,
                periodNumber: Number(t.periodNumber),
                startTime: t.startTime,
                endTime: t.endTime,
                isActive: true,
              },
            }),
          );
        }
      }
      return results;
    });
  }

  // SUBJECTS
  async getSubjects(tenantId: string) {
    if (true) {
      return this.academicRepo.findSubjects(tenantId);
    }
    return this.prisma.subject.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createSubject(tenantId: string, data: { name: string; code?: string; description?: string }) {
    if (!data.name) throw new BadRequestException('Subject Name is required.');

    if (true) {
      return this.academicRepo.createSubject({
        name: data.name.trim(),
        tenantId,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }

    const existing = await this.prisma.subject.findFirst({
      where: { tenantId, name: data.name, isActive: true },
    });
    if (existing) {
      throw new BadRequestException(`A subject with the name "${data.name}" already exists.`);
    }

    return this.prisma.subject.create({
      data: {
        id: randomUUID(),
        tenantId,
        name: data.name,
        isActive: true,
      },
    });
  }

  async deleteSubject(tenantId: string, id: string) {
    if (true) {
      return this.academicRepo.deleteSubject ? this.academicRepo.deleteSubject(id) : { id };
    }
    return this.prisma.subject.delete({
      where: { id },
    });
  }

  async bulkCreateSubjects(tenantId: string, subjectsData: any[]) {
    if (!subjectsData || subjectsData.length === 0) {
      throw new BadRequestException('No subject data provided.');
    }

    if (true) {
      let created = 0;
      for (const item of subjectsData) {
        if (item.name && item.name.trim()) {
          await this.academicRepo.createSubject({
            name: item.name.trim(),
            tenantId,
            isActive: true,
            createdAt: new Date().toISOString(),
          });
          created++;
        }
      }
      return { created, skipped: 0, errors: 0, errorDetails: [] };
    }

    const activeSubjects = await this.prisma.subject.findMany({
      where: { tenantId, isActive: true },
    });
    const existingNames = new Set(activeSubjects.map(s => s.name.toLowerCase()));

    const skipped: string[] = [];
    const errorDetails: string[] = [];
    let created = 0;

    for (let i = 0; i < subjectsData.length; i++) {
      const row = subjectsData[i];
      const name = row.name ? row.name.trim() : '';

      if (!name) {
        errorDetails.push(`Row ${i + 1}: Subject name is required.`);
        continue;
      }

      if (existingNames.has(name.toLowerCase())) {
        skipped.push(name);
        continue;
      }

      try {
        await this.prisma.subject.create({
          data: {
            id: randomUUID(),
            tenantId,
            name,
            isActive: true,
          },
        });
        created++;
        existingNames.add(name.toLowerCase());
      } catch (err: any) {
        errorDetails.push(`${name}: ${err.message}`);
      }
    }

    return {
      created,
      skipped: skipped.length,
      errors: errorDetails.length,
      errorDetails,
      skippedNames: skipped,
    };
  }

  // TIMETABLE CONFIG
  async getTimetableConfig(tenantId: string) {
    if (process.env.DB_PROVIDER === 'firebase' && this.firebase) {
      try {
        const doc = await this.firebase.getFirestore().collection('tenants').doc(tenantId).collection('timetableConfig').doc('current').get();
        if (doc.exists) return doc.data();
      } catch (err) {
        console.error('Error fetching timetable config:', err);
      }
    }
    return {
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      schoolStartTime: '09:00 AM',
      schoolEndTime: '04:00 PM',
      periodDuration: 45,
      autoGenerate: true,
      numPeriods: 8,
    };
  }

  async checkExistingTimetables(tenantId: string) {
    return { hasExistingTimetables: false };
  }

  async saveTimetableConfig(tenantId: string, data: any) {
    if (process.env.DB_PROVIDER === 'firebase' && this.firebase) {
      const ref = this.firebase.getFirestore().collection('tenants').doc(tenantId).collection('timetableConfig').doc('current');
      await ref.set({ ...data, tenantId, updatedAt: new Date().toISOString() }, { merge: true });
      return { success: true, ...data };
    }
    return { success: true, ...data };
  }

  // TEACHERS FOR SUBJECTS (STRICT SKILL FILTERING BY TENANT)
  async getTeachersForSubject(tenantId: string, subjectIds: string[]) {
    if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
      throw new BadRequestException('Tenant ID is required');
    }
    if (!subjectIds || subjectIds.length === 0) return {};

    const db = this.firebase?.getFirestore();
    const teachers = await this.teacherRepo.findTeachersByTenant(tenantId);

    // Fetch subject docs for subject name resolution
    const subjectMap: Record<string, string> = {};
    if (db) {
      try {
        const subSnap = await db.collection('tenants').doc(tenantId).collection('subjects').get();
        subSnap.docs.forEach((doc) => {
          const d = doc.data();
          if (d.name) subjectMap[doc.id] = d.name;
        });
      } catch (e) {}
    }

    const result: Record<string, any[]> = {};
    for (const sid of subjectIds) {
      const subjectName = (subjectMap[sid] || sid).toLowerCase().trim();

      const qualified = teachers.filter((t) => {
        // Collect all potential skill/subject indicators
        const rawSubs: any = t.subjectsTaught || t.subjects || t.qualification || t.skills || [];
        let subStrings: string[] = [];

        if (Array.isArray(rawSubs)) {
          subStrings = rawSubs.map((s) => {
            if (typeof s === 'string') return s.toLowerCase().trim();
            if (s && typeof s === 'object') return (s.name || s.subjectName || s.subjectId || '').toLowerCase().trim();
            return '';
          }).filter(Boolean);
        } else if (typeof rawSubs === 'string') {
          subStrings = rawSubs.split(',').map((s) => s.toLowerCase().trim());
        }

        if (t.qualification && typeof t.qualification === 'string') {
          subStrings.push(t.qualification.toLowerCase().trim());
        }

        return subStrings.some((s) => s.includes(subjectName) || subjectName.includes(s));
      });

      result[sid] = qualified.map((t) => ({
        Id: t.id || t.teacherId || t.userId,
        Name: t.name || t.teacherName || t.User?.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Teacher',
        Teacher_Skill__c: 'Expert',
      }));
    }
    return result;
  }

  async getTeachersForSubjectInClass(tenantId: string, subjectId?: string, classSectionId?: string) {
    if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
      throw new BadRequestException('Tenant ID is required');
    }
    const tid = tenantId;
    const db = this.firebase?.getFirestore();
    const teachers = await this.teacherRepo.findTeachersByTenant(tid);

    if (!subjectId) {
      return teachers.map((t) => ({
        id: t.id || t.teacherId || t.userId,
        name: t.name || t.teacherName || t.User?.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Teacher',
        teacherId: t.id || t.teacherId || t.userId,
        teacherName: t.name || t.teacherName || t.User?.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Teacher',
      }));
    }

    let subjectName = subjectId;
    if (db && subjectId) {
      try {
        const subDoc = await db.collection('tenants').doc(tid).collection('subjects').doc(subjectId).get();
        if (subDoc.exists && subDoc.data()?.name) {
          subjectName = subDoc.data()?.name;
        }
      } catch (e) {}
    }

    const cleanSubject = subjectName.toLowerCase().trim();

    const qualified = teachers.filter((t) => {
      const rawSubs: any = t.subjectsTaught || t.subjects || t.qualification || t.skills || [];
      let subStrings: string[] = [];
      if (Array.isArray(rawSubs)) {
        subStrings = rawSubs.map((s) => (typeof s === 'string' ? s.toLowerCase().trim() : (s?.name || s?.subjectName || '').toLowerCase().trim())).filter(Boolean);
      } else if (typeof rawSubs === 'string') {
        subStrings = rawSubs.split(',').map((s) => s.toLowerCase().trim());
      }
      return subStrings.some((s) => s.includes(cleanSubject) || cleanSubject.includes(s));
    });

    return qualified.map((t) => ({
      id: t.id || t.teacherId || t.userId,
      name: t.name || t.teacherName || t.User?.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Teacher',
      teacherId: t.id || t.teacherId || t.userId,
      teacherName: t.name || t.teacherName || t.User?.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Teacher',
    }));
  }

  // CREATE TEACHER WITH SKILLS
  async createTeacherWithSkills(tenantId: string, data: any) {
    if (!data.firstName || !data.lastName) {
      throw new BadRequestException('First Name and Last Name are required.');
    }
    if (!data.email) {
      throw new BadRequestException('Email is required.');
    }

    if (true) {
      const userId = 'user-t-' + Date.now();
      const teacherId = 'teacher-' + Date.now();

      await this.userRepo.create({
        id: userId,
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        role: 'TEACHER',
        phone: data.phone || null,
        tenantId,
        isActive: true,
        createdAt: new Date().toISOString(),
      });

      await this.teacherRepo.createTeacherAssignment({
        id: teacherId,
        userId,
        tenantId,
        qualification: data.qualification || '',
        basicSalary: data.basicSalary || 0,
        createdAt: new Date().toISOString(),
      });

      if (data.skills && Array.isArray(data.skills)) {
        for (const skill of data.skills) {
          if (skill.subjectId) {
            await this.teacherRepo.createTeacherSkill({
              teacherId,
              subjectId: skill.subjectId,
              skillLevel: skill.skillLevel || 'Expert',
              yearsOfExperience: skill.yearsOfExperience || 1,
              tenantId,
            });
          }
        }
      }

      return { id: teacherId, userId, name: `${data.firstName} ${data.lastName}` };
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new BadRequestException('A user with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash('Welcome2026!', 10);
    const userId = randomUUID();
    const teacherId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          email: data.email,
          passwordHash: hashedPassword,
          name: `${data.firstName} ${data.lastName}`,
          role: 'TEACHER',
          phone: data.phone || null,
          isActive: true,
          tenantId,
          updatedAt: new Date(),
        },
      });

      const staff = await tx.staffProfile.create({
        data: {
          id: teacherId,
          userId,
          designation: 'Teacher',
          joiningDate: new Date(),
          qualification: data.qualification || null,
          basicSalary: data.basicSalary || null,
        },
      });

      if (data.skills && Array.isArray(data.skills)) {
        for (const skill of data.skills) {
          if (skill.subjectId) {
            await tx.teacherSkill.create({
              data: {
                id: randomUUID(),
                teacherId: staff.id,
                subjectId: skill.subjectId,
                skillLevel: skill.skillLevel || 'Expert',
                yearsOfExperience: skill.yearsOfExperience || 1,
                tenantId,
              },
            });
          }
        }
      }

      return { id: staff.id, userId: staff.userId, name: `${data.firstName} ${data.lastName}` };
    });
  }

  async getTeacherSkills(tenantId: string, teacherId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    if (this.firebase) {
      try {
        const db = this.firebase.getFirestore();
        const subSnap = await db.collection('tenants').doc(tenantId).collection('subjects').get();
        const subjectsMap = new Map<string, string>();
        subSnap.docs.forEach(d => subjectsMap.set(d.id, d.data()?.name || 'Subject'));

        const snap = await db.collection('tenants').doc(tenantId).collection('teacherSkills').where('teacherId', '==', teacherId).get();
        return snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            subjectName: subjectsMap.get(d.subjectId) || d.subjectName || 'Subject',
          };
        });
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  // BULK CREATE TEACHERS (Firestore + Fuzzy Spelling Auto-Correction)
  async bulkCreateTeachers(tenantId: string, teachersData: any[]) {
    if (!teachersData || teachersData.length === 0) {
      throw new BadRequestException('No teacher data provided.');
    }

    if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
      throw new BadRequestException('Tenant ID is required');
    }
    const tid = tenantId;
    let created = 0;
    let skillsCreated = 0;
    const skipped: string[] = [];
    const errorDetails: string[] = [];

    // Helper for fuzzy subject matching & typo correction
    const typoSubjectMap: Record<string, string> = {
      'math': 'Mathematics',
      'maths': 'Mathematics',
      'mathematic': 'Mathematics',
      'mathematics': 'Mathematics',
      'mathamatios': 'Mathematics',
      'mathamatic': 'Mathematics',
      'phy': 'Physics',
      'physic': 'Physics',
      'physics': 'Physics',
      'chem': 'Chemistry',
      'chemist': 'Chemistry',
      'chemistry': 'Chemistry',
      'bio': 'Biology',
      'biol': 'Biology',
      'biology': 'Biology',
      'sci': 'Science',
      'scinece': 'Science',
      'science': 'Science',
      'eng': 'English',
      'inglish': 'English',
      'english': 'English',
      'hin': 'Hindi',
      'hindi': 'Hindi',
      'hindhi': 'Hindi',
      'soc': 'Social Science',
      'social': 'Social Science',
      'sst': 'Social Science',
      'social science': 'Social Science',
      'comp': 'Computer Science',
      'cs': 'Computer Science',
      'computer': 'Computer Science',
      'computers': 'Computer Science',
      'computer science': 'Computer Science',
      'eco': 'Economics',
      'economics': 'Economics',
      'pe': 'Physical Education',
      'sports': 'Physical Education',
      'physical education': 'Physical Education',
      'art': 'Art & Craft',
      'arts': 'Art & Craft',
      'art & craft': 'Art & Craft'
    };

    const normalizeSubject = (raw: string): string => {
      if (!raw || !raw.trim()) return 'General';
      const clean = raw.trim().toLowerCase();
      if (typoSubjectMap[clean]) return typoSubjectMap[clean];
      for (const [key, target] of Object.entries(typoSubjectMap)) {
        if (clean.includes(key) || key.includes(clean)) return target;
      }
      return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1);
    };

    for (let i = 0; i < teachersData.length; i++) {
      const row = teachersData[i];
      const firstName = row.firstName ? row.firstName.trim() : '';
      const lastName = row.lastName ? row.lastName.trim() : '';
      const email = row.email ? row.email.trim() : '';

      if (!firstName || !email) {
        errorDetails.push(`Row ${i + 1}: First Name and Email are required.`);
        continue;
      }

      const fullName = lastName ? `${firstName} ${lastName}` : firstName;

      try {
        // Check if user already exists
        const existingUser = await this.userRepo.findByEmail(email);
        if (existingUser) {
          skipped.push(`${fullName} (${email})`);
          continue;
        }

        const userId = randomUUID();
        const staffProfileId = randomUUID();
        const defaultPassword = row.phone || 'edutrack123';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        // 1. Create User in Repository / Firestore
        await this.userRepo.create({
          id: userId,
          email,
          passwordHash,
          name: fullName,
          role: 'TEACHER',
          phone: row.phone || null,
          isActive: true,
          tenantId: tid,
          updatedAt: new Date(),
        });

        // 2. Resolve Subjects Taught with Smart Typo Correction
        const subjectsTaughtList: string[] = [];
        if (Array.isArray(row.skills) && row.skills.length > 0) {
          row.skills.forEach((sk: any) => {
            const raw = sk.subjectId || sk.subjectName || sk.subject;
            if (raw) subjectsTaughtList.push(normalizeSubject(raw));
          });
        }
        for (let sIdx = 1; sIdx <= 3; sIdx++) {
          const raw = row[`subject${sIdx}`] || row[`Subject ${sIdx}`];
          if (raw) subjectsTaughtList.push(normalizeSubject(raw));
        }

        const safeSubjects = Array.from(new Set(subjectsTaughtList.filter(Boolean)));
        const finalSubjects = safeSubjects.length > 0 ? safeSubjects : ['Mathematics'];

        const safeJoiningDate = row.joiningDate && !isNaN(new Date(row.joiningDate).getTime())
          ? new Date(row.joiningDate)
          : new Date();

        // 3. Create StaffProfile in Repository / Firestore
        await this.teacherRepo.createStaffProfile({
          id: staffProfileId,
          userId,
          tenantId: tid,
          employeeId: row.employeeId || `EMP-T-${staffProfileId.substring(0, 4).toUpperCase()}`,
          designation: row.designation || 'Teacher',
          qualification: row.qualification || 'Master Degree',
          joiningDate: safeJoiningDate,
          status: 'Active',
          basicSalary: row.basicSalary ? Number(row.basicSalary) : 35000,
          allowances: row.allowances ? Number(row.allowances) : 4000,
          pfDeduction: row.pf ? Number(row.pf) : 1500,
          subjectsTaught: finalSubjects,
        });

        // 4. Save Teacher Skills if Firestore is active
        if (this.firebase) {
          try {
            const db = this.firebase.getFirestore();
            for (const subName of finalSubjects) {
              await db.collection('tenants').doc(tid).collection('teacherSkills').add({
                teacherId: staffProfileId,
                subjectName: subName,
                skillLevel: 'Expert',
                yearsOfExperience: 5,
                createdAt: new Date().toISOString(),
              });
              skillsCreated++;
            }
          } catch (fErr) {}
        }

        created++;
      } catch (err: any) {
        errorDetails.push(`${fullName}: ${err.message || 'Import error'}`);
      }
    }

    return {
      success: true,
      created,
      skipped: skipped.length,
      errors: errorDetails.length,
      errorDetails,
      skippedNames: skipped,
      skillsCreated,
    };
  }

  // WORKLOAD SUMMARY
  async getWorkloadSummary(tenantId: string, academicYearId?: string) {
    if (true) {
      const db = this.firebase?.getFirestore();
      if (!db) return { totalClassSections: 0, totalTeachers: 0, totalAssignments: 0, avgLoadPercent: 0 };

      try {
        const csSnap = await db.collection('tenants').doc(tenantId).collection('classSections').get();
        const totalClassSections = csSnap.size;

        const teachers = await this.teacherRepo.findTeachersByTenant(tenantId);
        const totalTeachers = teachers.length;

        let totalAssignments = 0;
        try {
          const taSnap = await db.collection('tenants').doc(tenantId).collection('teacherAssignments').get();
          totalAssignments = taSnap.size;
        } catch (e) {
          console.warn('Could not fetch teacherAssignments:', e);
        }

        const avgLoadPercent = totalTeachers > 0 && totalAssignments > 0
          ? Math.min(Math.round((totalAssignments / totalTeachers / 8) * 100), 100)
          : 0;

        return { totalClassSections, totalTeachers, totalAssignments, avgLoadPercent };
      } catch (err) {
        console.error('Firebase getWorkloadSummary error:', err);
        return { totalClassSections: 0, totalTeachers: 0, totalAssignments: 0, avgLoadPercent: 0 };
      }
    }

    // Existing Prisma path
    const activeYear = academicYearId
      ? await this.prisma.academicYear.findUnique({ where: { id: academicYearId } })
      : await this.prisma.academicYear.findFirst({ where: { tenantId, isActive: true } });

    if (!activeYear) return { totalClassSections: 0, totalTeachers: 0, totalAssignments: 0, avgLoadPercent: 0 };

    // Find classSections linked to classes in this academic year
    const sections = await this.prisma.classSection.findMany({
      where: {
        tenantId,
        Class: { academicYearId: activeYear.id },
      },
    });
    const sectionIds = sections.map(s => s.id);

    const totalClassSections = sections.length;

    // Find TeacherAssignments in these sections
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        tenantId,
        classSectionId: { in: sectionIds },
      },
    });

    const totalAssignments = assignments.length;
    const uniqueTeachers = new Set(assignments.map(a => a.teacherId));
    const totalTeachers = uniqueTeachers.size;

    let avgLoadPercent = 0;
    if (totalTeachers > 0 && totalAssignments > 0) {
      // Estimate load per teacher (average assignments divided by standard load)
      avgLoadPercent = Math.min(Math.round((totalAssignments / totalTeachers / 8) * 100), 100);
    }

    return {
      totalClassSections,
      totalTeachers,
      totalAssignments,
      avgLoadPercent,
    };
  }

  // GET ALL TEACHER WORKLOADS
  async getAllTeacherWorkloads(tenantId: string) {
    if (true) {
      try {
        const db = this.firebase?.getFirestore();
        if (!db) return [];

        const teachers = await this.teacherRepo.findTeachersByTenant(tenantId);
        
        // Fetch all teacher assignments for this tenant without needing composite indexes
        let assignments: any[] = [];
        try {
          const assignSnap = await db.collection('tenants').doc(tenantId).collection('teacherAssignments').get();
          assignments = assignSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn('Could not fetch teacherAssignments collection:', e);
        }

        const assignMap = new Map<string, any[]>();
        for (const a of assignments) {
          const tId = a.teacherId || a.userId;
          if (tId) {
            if (!assignMap.has(tId)) assignMap.set(tId, []);
            assignMap.get(tId)!.push(a);
          }
        }

        const MAX_WEEKLY_PERIODS = 48;

        return teachers.map((t: any) => {
          const tId = t.id || t.teacherId || t.userId;
          const myAssignments = assignMap.get(tId) || assignMap.get(t.userId) || [];
          const totalPeriods = myAssignments.reduce((sum, a) => sum + (Number(a.periodsPerWeek) || 5), 0);
          const subjectCount = new Set(myAssignments.map(a => a.subjectId).filter(Boolean)).size;
          const classCount = new Set(myAssignments.map(a => a.classSectionId).filter(Boolean)).size;
          const loadPercent = Math.min(Math.round((totalPeriods / MAX_WEEKLY_PERIODS) * 100), 100);

          return {
            teacherId: tId,
            teacherName: t.name || t.User?.name || t.user?.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Teacher',
            subjectsTaught: t.subjectsTaught || [],
            subjectCount,
            classCount,
            totalPeriods,
            loadPercent,
          };
        });
      } catch (err) {
        console.error('Firebase getAllTeacherWorkloads error:', err);
        return [];
      }
    }

    // Existing Prisma path
    const teachers = await this.prisma.staffProfile.findMany({
      where: { User: { tenantId, role: 'TEACHER' } },
      include: { User: true },
      orderBy: { User: { name: 'asc' } },
    });

    const periodCounts = await this.prisma.period.groupBy({
      by: ['teacherId'],
      where: { tenantId, teacherId: { not: null } },
      _count: { id: true },
    });
    const periodCountMap = new Map(periodCounts.map(pc => [pc.teacherId, pc._count.id]));

    const uniqueSubjects = await this.prisma.period.findMany({
      where: { tenantId, teacherId: { not: null } },
      select: { teacherId: true, subjectId: true },
      distinct: ['teacherId', 'subjectId'],
    });
    const subjectCountMap = new Map<string, number>();
    for (const us of uniqueSubjects) {
      if (us.teacherId) {
        subjectCountMap.set(us.teacherId, (subjectCountMap.get(us.teacherId) || 0) + 1);
      }
    }

    const uniqueClasses = await this.prisma.period.findMany({
      where: { tenantId, teacherId: { not: null } },
      select: { teacherId: true, classSectionId: true },
      distinct: ['teacherId', 'classSectionId'],
    });
    const classCountMap = new Map<string, number>();
    for (const uc of uniqueClasses) {
      if (uc.teacherId) {
        classCountMap.set(uc.teacherId, (classCountMap.get(uc.teacherId) || 0) + 1);
      }
    }

    const MAX_WEEKLY_PERIODS = 48;

    return teachers.map((t) => {
      const totalPeriods: number = Number(periodCountMap.get(t.id) || 0);
      const subjectCount: number = Number(subjectCountMap.get(t.id) || 0);
      const classCount: number = Number(classCountMap.get(t.id) || 0);
      const loadPercent = Math.min(Math.round((totalPeriods / MAX_WEEKLY_PERIODS) * 100), 100);

      return {
        teacherId: t.id,
        teacherName: t.User.name,
        subjectCount,
        classCount,
        totalPeriods,
        loadPercent,
      };
    });
  }

  // GET ALL CLASS WORKLOADS
  async getAllClassWorkloads(tenantId: string) {
    if (true) {
      try {
        const db = this.firebase?.getFirestore();
        if (!db) return [];

        const csSnap = await db.collection('tenants').doc(tenantId).collection('classSections').get();
        const classesSnap = await db.collection('tenants').doc(tenantId).collection('classes').get();
        const sectionsSnap = await db.collection('tenants').doc(tenantId).collection('sections').get();
        
        let assignments: any[] = [];
        try {
          const taSnap = await db.collection('tenants').doc(tenantId).collection('teacherAssignments').get();
          assignments = taSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn('Could not fetch teacherAssignments:', e);
        }

        const classMap = new Map(classesSnap.docs.map(d => [d.id, d.data().name]));
        const secMap = new Map(sectionsSnap.docs.map(d => [d.id, d.data().name]));

        return csSnap.docs.map((doc) => {
          const cs = { id: doc.id, ...doc.data() } as any;
          const className = classMap.get(cs.classId) || cs.className || 'Class';
          const sectionName = secMap.get(cs.sectionId) || cs.sectionName || 'A';
          const myAssign = assignments.filter((a: any) => a.classSectionId === cs.id);
          const subjectCount = (cs.subjects || []).length || myAssign.length;
          const staffedCount = myAssign.length;
          const loadPercent = subjectCount > 0 ? Math.round((staffedCount / subjectCount) * 100) : 0;

          return {
            classSectionId: cs.id,
            classId: cs.classId,
            name: `${className} - ${sectionName}`,
            academicYear: cs.academicYear || '2026-2027',
            subjectCount,
            staffedCount,
            loadPercent,
          };
        });
      } catch (err) {
        console.error('Firebase getAllClassWorkloads error:', err);
        return [];
      }
    }

    // Existing Prisma implementation
    const sections = await this.prisma.classSection.findMany({
      where: { tenantId },
      include: {
        Class: { include: { AcademicYear: true } },
        Section: true,
      },
      orderBy: { Class: { name: 'asc' } },
    });

    const classSubjects = await this.prisma.classSubject.groupBy({
      by: ['classSectionId'],
      where: { tenantId },
      _count: { id: true },
    });
    const subjectCountMap = new Map(classSubjects.map(cs => [cs.classSectionId, cs._count.id]));

    const staffed = await this.prisma.teacherAssignment.groupBy({
      by: ['classSectionId'],
      where: { tenantId },
      _count: { subjectId: true },
    });
    const staffedCountMap = new Map(staffed.map(s => [s.classSectionId, s._count.subjectId]));

    return sections.map((cs) => {
      const totalSubjects: number = Number(subjectCountMap.get(cs.id) || 0);
      const staffedSubjects: number = Number(staffedCountMap.get(cs.id) || 0);
      const loadPercent = totalSubjects > 0 ? Math.round((staffedSubjects / totalSubjects) * 100) : 0;

      return {
        classSectionId: cs.id,
        name: `${cs.Class.name} - ${cs.Section.name}`,
        academicYear: cs.Class.AcademicYear.name,
        subjectCount: totalSubjects,
        staffedCount: staffedSubjects,
        loadPercent,
      };
    });
  }

  // GET DETAILED WORKLOAD FOR TEACHER
  async getTeacherWorkload(tenantId: string, teacherId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const db = this.firebase?.getFirestore();
    if (!db) throw new Error('Firestore DB not initialized');

    let teacherName = 'Teacher';
    const tDoc = await db.collection('staffProfiles').doc(teacherId).get();
    if (tDoc.exists) {
      const d = tDoc.data();
      teacherName = d?.user?.name || d?.name || 'Teacher';
    }

    const periodsSnap = await db.collection('tenants').doc(tenantId).collection('periods').where('teacherId', '==', teacherId).get();
    const periods = periodsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const classSectionMap = new Map<string, any[]>();
    for (const p of periods) {
      const csId = (p as any).classSectionId || 'default-cs';
      if (!classSectionMap.has(csId)) classSectionMap.set(csId, []);
      classSectionMap.get(csId)!.push(p);
    }

    const classes = [];
    for (const [csId, pList] of classSectionMap.entries()) {
      classes.push({
        classSectionId: csId,
        className: pList[0]?.className || 'Class Section',
        academicYear: '2026-2027',
        subjects: pList.map(p => ({
          assignmentId: p.id,
          subjectId: p.subjectId,
          subjectName: p.subjectName || 'Subject',
          periodsPerWeek: 5,
          fromTimetable: true,
        })),
      });
    }

    return {
      teacherName,
      classes,
    };
  }

  // GET DETAILED WORKLOAD FOR CLASS SECTION
  async getClassSectionWorkload(tenantId: string, classSectionId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const db = this.firebase?.getFirestore();
    if (!db) throw new Error('Firestore DB not initialized');

    let csName = 'Class-2 - Section A';
    let academicYear = '2026-2027';

    const csDoc = await db.collection('tenants').doc(tenantId).collection('classSections').doc(classSectionId).get();
    if (csDoc.exists) {
      const data = csDoc.data();
      if (data?.name) csName = data.name;
    }

    const subSnap = await db.collection('tenants').doc(tenantId).collection('subjects').get();
    const subjectsList = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const periodsSnap = await db.collection('tenants').doc(tenantId).collection('periods').where('classSectionId', '==', classSectionId).get();
    const periods = periodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const uniqueTeachers = new Set(periods.map((p: any) => p.teacherId).filter(Boolean));

    const subjects = subjectsList.map((sub: any) => {
      const subPeriods = periods.filter((p: any) => p.subjectId === sub.id);
      return {
        subjectId: sub.id,
        subjectName: sub.name || 'Subject',
        teachers: subPeriods.map((p: any) => ({
          teacherId: p.teacherId || '',
          teacherName: p.teacherName || 'Assigned Teacher',
          assignmentId: p.id,
          periodsPerWeek: 5,
          fromTimetable: true,
        })),
      };
    });

    return {
      name: csName,
      academicYear,
      teacherCount: uniqueTeachers.size,
      subjects,
    };
  }

  // UPDATE TEACHER ASSIGNMENT
  async updateTeacherAssignment(tenantId: string, id: string, newTeacherId?: string, periodsPerWeek?: number) {
    if (!tenantId) throw new Error('tenantId is required');
    const db = this.firebase?.getFirestore();
    if (!db) throw new Error('Firestore DB not initialized');

    const ref = db.collection('tenants').doc(tenantId).collection('periods').doc(id);
    const updates: any = {};
    if (newTeacherId) updates.teacherId = newTeacherId;
    await ref.set(updates, { merge: true });
    return { id, ...updates };
  }

  // DELETE TEACHER ASSIGNMENT
  async deleteTeacherAssignment(tenantId: string, id: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const db = this.firebase?.getFirestore();
    if (!db) throw new Error('Firestore DB not initialized');

    await db.collection('tenants').doc(tenantId).collection('periods').doc(id).delete();
    return { success: true, id };
  }

  // CREATE CLASS SECTION (JUNCTION)
  async createClassSection(tenantId: string, data: any) {
    if (process.env.DB_PROVIDER === 'firebase' && this.firebase) {
      const db = this.firebase.getFirestore();
      const classSectionId = 'cs-' + Date.now();
      const csRef = db.collection('tenants').doc(tenantId).collection('classSections').doc(classSectionId);

      const subjects = Object.keys(data.subjectTeacherMap || {});
      const assignments = [];
      for (const subId of subjects) {
        const teacherIds = data.subjectTeacherMap[subId] || [];
        const periodsList = data.subjectPeriodsMap?.[subId] || [];
        for (let i = 0; i < teacherIds.length; i++) {
          assignments.push({
            id: 'assign-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            subjectId: subId,
            teacherId: teacherIds[i],
            periodsPerWeek: periodsList[i] !== undefined ? Number(periodsList[i]) : 5,
          });
        }
      }

      const csPayload = {
        id: classSectionId,
        tenantId,
        classId: data.classId,
        sectionId: data.sectionId,
        strength: data.classStrength || 0,
        subjects,
        assignments,
        createdAt: new Date().toISOString(),
      };

      await csRef.set(csPayload, { merge: true });

      for (const assign of assignments) {
        const assignRef = db.collection('tenants').doc(tenantId).collection('teacherAssignments').doc(assign.id);
        await assignRef.set({
          ...assign,
          tenantId,
          classSectionId,
          classId: data.classId,
          sectionId: data.sectionId,
          createdAt: new Date().toISOString(),
        }, { merge: true });
      }

      return { success: true, classSectionId, ...csPayload };
    }

    const existing = await this.prisma.classSection.findFirst({
      where: {
        tenantId,
        classId: data.classId,
        sectionId: data.sectionId,
      },
    });
    if (existing) {
      throw new BadRequestException('This Class and Section combination already exists.');
    }

    return this.prisma.$transaction(async (tx) => {
      const classSectionId = randomUUID();

      // 1. Create ClassSection
      await tx.classSection.create({
        data: {
          id: classSectionId,
          tenantId,
          classId: data.classId,
          sectionId: data.sectionId,
          strength: data.classStrength || 0,
        },
      });

      // 2. Create ClassSubjects
      const subjects = Object.keys(data.subjectTeacherMap);
      const classSubjectRecords = subjects.map((subId) => ({
        id: randomUUID(),
        tenantId,
        classSectionId,
        subjectId: subId,
      }));
      if (classSubjectRecords.length > 0) {
        await tx.classSubject.createMany({
          data: classSubjectRecords,
        });
      }

      // 3. Create TeacherAssignments
      const assignments = [];
      for (const subId of subjects) {
        const teacherIds = data.subjectTeacherMap[subId] || [];
        const periodsList = data.subjectPeriodsMap?.[subId] || [];

        for (let i = 0; i < teacherIds.length; i++) {
          const tId = teacherIds[i];
          const periods = periodsList[i] !== undefined ? Number(periodsList[i]) : 5;

          assignments.push({
            id: randomUUID(),
            tenantId,
            classSectionId,
            subjectId: subId,
            teacherId: tId,
            periodsPerWeek: periods,
          });
        }
      }

      if (assignments.length > 0) {
        await tx.teacherAssignment.createMany({
          data: assignments,
        });
      }

      return {
        classSectionId,
        subjectCount: classSubjectRecords.length,
        teacherAssignmentCount: assignments.length,
      };
    });
  }

  // GET ALL CLASS SECTIONS
  async getAllClassSections(tenantId: string) {
    if (true) {
      try {
        const classSections = await this.academicRepo.findClassSections(tenantId);
        const results = [];
        const db = this.firebase?.getFirestore();
        for (const cs of classSections) {
          let className = '';
          let sectionName = '';
          if (db && cs.classId) {
            const classDoc = await db.collection('tenants').doc(tenantId).collection('classes').doc(cs.classId).get();
            className = classDoc.exists ? classDoc.data()?.name || '' : '';
          }
          if (db && cs.sectionId) {
            const sectionDoc = await db.collection('tenants').doc(tenantId).collection('sections').doc(cs.sectionId).get();
            sectionName = sectionDoc.exists ? sectionDoc.data()?.name || '' : '';
          }
          results.push({
            Id: cs.id,
            Name: `${className} - ${sectionName}`,
            className,
            sectionName,
            academicYear: '',
            classId: cs.classId,
          });
        }
        return results;
      } catch (err) {
        console.error('Firebase getAllClassSections error:', err);
        return [];
      }
    }
    const sections = await this.prisma.classSection.findMany({
      where: { tenantId },
      include: {
        Class: true,
        Section: true,
      },
      orderBy: [
        { Class: { name: 'asc' } },
        { Section: { name: 'asc' } },
      ],
    });

    return sections.map((s) => ({
      Id: s.id,
      Name: `${s.Class.name} - ${s.Section.name}`,
      className: s.Class.name,
      sectionName: s.Section.name,
      academicYear: '',
      classId: s.classId,
    }));
  }

  // GET ALL TEACHERS
  async getAllTeachers(tenantId: string) {
    if (true) {
      try {
        const teachers = await this.teacherRepo.findTeachersByTenant(tenantId);
        return teachers.map((t: any) => ({
          Id: t.id,
          Name: t.User?.name || t.user?.name || 'Unknown Teacher',
        }));
      } catch (err) {
        console.error('Firebase getAllTeachers error:', err);
        return [];
      }
    }
    const list = await this.prisma.staffProfile.findMany({
      where: { User: { tenantId, role: 'TEACHER' } },
      include: { User: true },
      orderBy: { User: { name: 'asc' } },
    });
    return list.map(t => ({ Id: t.id, Name: t.User.name }));
  }

  // GET TIMETABLE FOR CLASS
  async getTimetableForClass(
    tenantId: string,
    classSectionId: string,
    academicYearId?: string,
    startDate?: string,
    endDate?: string
  ) {
    if (!tenantId) throw new Error('tenantId is required');
    const db = this.firebase?.getFirestore();
    if (!db) throw new Error('Firestore DB not initialized');

    const periodsSnap = await db.collection('tenants').doc(tenantId).collection('periods').where('classSectionId', '==', classSectionId).get();
    const periods = periodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const subjectsSnap = await db.collection('tenants').doc(tenantId).collection('subjects').get();
    const subjectsMap = new Map<string, string>();
    subjectsSnap.docs.forEach(doc => subjectsMap.set(doc.id, doc.data()?.name));

    const teachersSnap = await db.collection('staffProfiles').where('tenantId', '==', tenantId).get();
    const teachersMap = new Map<string, string>();
    teachersSnap.docs.forEach(doc => {
      const d = doc.data();
      teachersMap.set(doc.id, d?.user?.name || d?.name || 'Teacher');
    });

    const resultList: any[] = [];
    const resultMap: Record<string, any> = {};

    for (const p of periods) {
      const rawDay = (p as any).dayOfWeek || (p as any).day || 'Monday';
      const cleanDay = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();
      const num = Number((p as any).periodNumber || (p as any).num || 1);
      const key = `${cleanDay.toUpperCase()}_${num}`;

      const regularTeacherId = (p as any).teacherId;
      const regularTeacherName = (p as any).teacherName || teachersMap.get((p as any).teacherId) || 'Unassigned';

      let isOnLeave = false;
      let onLeaveTeacherName = null;
      let substituteTeacherIdStr = null;
      let substituteTeacherName = null;

      if ((p as any).substituteTeacherId) {
        isOnLeave = true;
        onLeaveTeacherName = regularTeacherName;
        substituteTeacherIdStr = (p as any).substituteTeacherId;
        substituteTeacherName = teachersMap.get((p as any).substituteTeacherId) || 'Substitute';
      }

      const item = {
        periodId: (p as any).id,
        id: (p as any).id,
        day: cleanDay,
        dayOfWeek: cleanDay,
        periodNumber: num,
        subjectId: (p as any).subjectId,
        subjectName: (p as any).subjectName || subjectsMap.get((p as any).subjectId) || (p as any).subjectId || '—',
        teacherId: isOnLeave ? substituteTeacherIdStr : regularTeacherId,
        teacherName: isOnLeave ? substituteTeacherName : regularTeacherName,
        regularTeacherId,
        isOnLeave,
        onLeaveTeacherName,
        substituteTeacherId: substituteTeacherIdStr,
        substituteTeacherName,
      };

      resultList.push(item);
      resultMap[key] = item;
    }

    Object.assign(resultList, resultMap);
    return resultList;
  }

  // LEASER PERIODS (TEACHER ON LEAVE / SUBSTITUTED)
  async getLeaserPeriodsForTeacher(tenantId: string, teacherId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const db = this.firebase?.getFirestore();
    if (!db) throw new Error('Firestore DB not initialized');

    const snap = await db.collection('tenants').doc(tenantId).collection('periods').where('substituteTeacherId', '==', teacherId).get();
    return snap.docs.map(doc => doc.id);
  }

  // GET PERIODS FOR TEACHER
  async getPeriodsForTeacher(tenantId: string, teacherId: string): Promise<any[]> {
    if (!tenantId) throw new Error('tenantId is required');
    const db = this.firebase?.getFirestore();
    if (!db) throw new Error('Firestore DB not initialized');

    const snap1 = await db.collection('tenants').doc(tenantId).collection('periods').where('teacherId', '==', teacherId).get();
    const snap2 = await db.collection('tenants').doc(tenantId).collection('periods').where('substituteTeacherId', '==', teacherId).get();

    const map = new Map<string, any>();
    snap1.docs.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() }));
    snap2.docs.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() }));

    const periods = Array.from(map.values());
    return periods.map(p => {
      const isSubbed = p.substituteTeacherId === teacherId;
      return {
        periodId: p.id,
        day: p.dayOfWeek || 'MONDAY',
        periodNumber: p.periodNumber || 1,
        classSectionId: p.classSectionId || '',
        className: p.className || 'Class Section',
        academicYear: p.academicYear || '',
        startTime: p.startTime || '',
        endTime: p.endTime || '',
        subjectId: p.subjectId || '',
        subjectName: p.subjectName || 'Subject',
        isLeaser: isSubbed,
        isSubstitute: !!p.substituteTeacherId,
        substituteTeacherId: p.substituteTeacherId || null,
        originalTeacherName: p.teacherName || 'Teacher',
        teacherId: isSubbed ? p.substituteTeacherId : p.teacherId,
        teacherName: p.teacherName || 'Teacher',
      };
    });
  }

  // GET PERIODS FOR TEACHER WITH GAPS
  async getPeriodsForTeacherWithGaps(tenantId: string, teacherId: string): Promise<any[]> {
    const actualPeriods = await this.getPeriodsForTeacher(tenantId, teacherId);
    const totalPeriods = 8;

    const existingKeys = new Set<string>();
    const daySet = new Map<string, string>();
    for (const p of actualPeriods) {
      existingKeys.add(`${p.day}_${p.periodNumber}`);
      daySet.set(p.day, p.day);
    }

    const schoolDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const resultList = [...actualPeriods];

    for (const day of schoolDays) {
      if (!daySet.has(day)) continue;
      for (let i = 1; i <= totalPeriods; i++) {
        const key = `${day}_${i}`;
        if (!existingKeys.has(key)) {
          resultList.push({
            periodId: `free_${day}_${i}`,
            day,
            periodNumber: i,
            classSectionId: '',
            className: '',
            academicYear: '',
            startTime: '',
            endTime: '',
            subjectId: null,
            subjectName: '',
            isLeaser: false,
            isFreePeriod: true,
            substituteTeacherId: null,
            substituteTeacherName: null,
            originalTeacherName: '',
            teacherId: '',
            teacherName: '',
          });
        }
      }
    }

    return resultList;
  }

  // SUBSTITUTE TEACHER MANAGEMENT
  async saveSubstituteForPeriod(tenantId: string, periodId: string, substituteTeacherId?: string) {
    if (!tenantId) throw new Error('tenantId is required');
    const db = this.firebase?.getFirestore();
    if (!db) throw new Error('Firestore DB not initialized');

    const ref = db.collection('tenants').doc(tenantId).collection('periods').doc(periodId);
    await ref.set({ substituteTeacherId: substituteTeacherId || null }, { merge: true });
    return { id: periodId, substituteTeacherId: substituteTeacherId || null };
  }

  // SAVE TIMETABLE PERIODS
  async saveTimetablePeriods(tenantId: string, data: any) {
    if (!tenantId) throw new Error('tenantId is required');
    if (!data.periods || data.periods.length === 0) {
      throw new BadRequestException('No periods provided.');
    }
    const db = this.firebase?.getFirestore();
    if (!db) throw new Error('Firestore DB not initialized');

    const batch = db.batch();
    const colRef = db.collection('tenants').doc(tenantId).collection('periods');

    const existingSnap = await colRef.where('classSectionId', '==', data.classSectionId).get();
    existingSnap.docs.forEach(doc => batch.delete(doc.ref));

    let csName = 'Class';
    let secName = 'Section';
    if (data.classSectionId) {
      try {
        const csDoc = await db.collection('tenants').doc(tenantId).collection('classSections').doc(data.classSectionId).get().catch(() => null);
        if (csDoc && csDoc.exists) {
          const d = csDoc.data();
          csName = d?.className || d?.name || csName;
          secName = d?.sectionName || d?.section || secName;
        }
      } catch (e) {}
    }

    let savedCount = 0;
    for (const p of data.periods) {
      if (!p.subjectId || !p.teacherId) continue;
      const id = p.id || randomUUID();
      const ref = colRef.doc(id);

      const rawDay = String(p.day || p.dayOfWeek || 'Monday').trim();
      const normalizedDay = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();

      const startTime = p.startTime || p.periodTiming?.startTime || (p.time ? p.time.split('-')[0]?.trim() : '') || '09:00 AM';
      const endTime = p.endTime || p.periodTiming?.endTime || (p.time ? p.time.split('-')[1]?.trim() : '') || '09:45 AM';

      const periodTiming = {
        periodNumber: Number(p.periodNumber || p.num || 1),
        displayPeriodNumber: p.periodNumber || p.num || 1,
        startTime,
        endTime,
        isBreak: !!p.isBreak,
      };

      const payload = {
        id,
        tenantId,
        academicYearId: data.academicYearId || 'ay-2026',
        classSectionId: data.classSectionId,
        className: data.className || csName,
        sectionName: data.sectionName || secName,
        classSection: {
          id: data.classSectionId,
          class: { name: data.className || csName },
          section: { name: data.sectionName || secName },
        },
        dayOfWeek: normalizedDay,
        day: normalizedDay,
        periodNumber: Number(p.periodNumber || p.num || 1),
        periodTimingId: p.periodTimingId || p.periodNumber || 1,
        periodTiming,
        startTime,
        endTime,
        isBreak: !!p.isBreak,
        subjectId: p.subjectId,
        subjectName: p.subjectName || '',
        subject: {
          id: p.subjectId,
          name: p.subjectName || '',
        },
        teacherId: p.teacherId,
        teacherName: p.teacherName || '',
        substituteTeacherId: p.substituteTeacherId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      batch.set(ref, payload, { merge: true });
      savedCount++;
    }

    await batch.commit();
    return { savedCount, success: true };
  }
}
