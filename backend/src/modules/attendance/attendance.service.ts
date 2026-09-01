import { Injectable, NotFoundException, Inject } from '@nestjs/common';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';
import { randomUUID } from 'crypto';
import { IAttendanceRepository } from '../../common/interfaces/attendance.repository.interface';
import { IStudentRepository } from '../../common/interfaces/student.repository.interface';
import { ITeacherRepository } from '../../common/interfaces/teacher.repository.interface';

@Injectable()
export class AttendanceService {
  constructor(
    @Inject('IAttendanceRepository') private readonly attendanceRepo: IAttendanceRepository,
    @Inject('IStudentRepository') private readonly studentRepo: IStudentRepository,
    @Inject('ITeacherRepository') private readonly teacherRepo: ITeacherRepository,
  ) {}

  async create(
    tenantId: string,
    data: { studentId: string; date: string; status: AttendanceStatus },
  ) {
    const student = await this.studentRepo.findProfileById(data.studentId);
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    if (!student.classSectionId) {
      throw new NotFoundException('Student is not assigned to any class section');
    }

    const dateObj = new Date(data.date);
    dateObj.setHours(0, 0, 0, 0);

    let session = await this.attendanceRepo.findSessionById(student.classSectionId);

    if (!session) {
      const staff = await this.teacherRepo.findProfileById(tenantId);
      if (!staff) {
        throw new NotFoundException('No staff profile found to take attendance');
      }

      session = await this.attendanceRepo.createSessionWithAttendance(
        {
          id: randomUUID(),
          tenantId,
          date: dateObj,
          classSectionId: student.classSectionId,
          takenById: staff.id,
        },
        [
          {
            id: randomUUID(),
            tenantId,
            studentId: data.studentId,
            status: data.status,
          },
        ],
      );
    }

    return session;
  }

  async findAll(tenantId: string) {
    return this.attendanceRepo.findSessionsByClassSection(tenantId);
  }

  async findOne(id: string, tenantId: string) {
    return this.attendanceRepo.findSessionById(id);
  }

  async findByStudent(studentId: string, tenantId: string) {
    return this.attendanceRepo.findAttendanceByStudent(studentId);
  }
}
