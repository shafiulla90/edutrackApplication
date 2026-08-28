export interface IAttendanceRepository {
  findSessionsByClassSection(classSectionId: string, startDate?: string, endDate?: string): Promise<any[]>;
  findSessionById(id: string): Promise<any | null>;
  findAttendanceByStudent(studentId: string): Promise<any[]>;
  createSessionWithAttendance(sessionData: any, attendanceRecords: any[]): Promise<any>;
  updateAttendance(id: string, status: string, reason?: string): Promise<any>;
}
