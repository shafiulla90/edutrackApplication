export interface ITeacherRepository {
  findProfileById(id: string): Promise<any | null>;
  findProfileByUserId(userId: string): Promise<any | null>;
  findTeachersByTenant(tenantId: string): Promise<any[]>;
  findTeacherAssignments(teacherId: string): Promise<any[]>;
  findTeacherSkills(teacherId: string): Promise<any[]>;
  createTeacherAssignment(data: any): Promise<any>;
  createTeacherSkill(data: any): Promise<any>;
  createStaffProfile(data: any): Promise<any>;
  updateStaffProfile(id: string, data: any): Promise<any>;
  deleteStaffProfile(id: string): Promise<any>;
  reconcileLegacyTeachers(tenantId: string): Promise<any>;
}

