export interface IAcademicRepository {
  findAcademicYears(tenantId: string): Promise<any[]>;
  findActiveAcademicYear(tenantId: string): Promise<any | null>;
  findClasses(tenantId: string, academicYearId?: string): Promise<any[]>;
  findClassById(id: string): Promise<any | null>;
  createClass(data: any): Promise<any>;
  deleteClass(id: string): Promise<any>;
  findSections(tenantId: string): Promise<any[]>;
  createSection(data: any): Promise<any>;
  deleteSection(id: string): Promise<any>;
  findClassSections(tenantId: string, classId?: string): Promise<any[]>;
  findSubjects(tenantId: string): Promise<any[]>;
  createSubject(data: any): Promise<any>;
  deleteSubject?(id: string): Promise<any>;
  createAcademicYear?(data: any): Promise<any>;
  toggleAcademicYearActive?(id: string, tenantId: string): Promise<any>;
  createClassSection?(data: any): Promise<any>;
  getClassStudentCount?(classId: string, tenantId: string): Promise<any>;
}
