export interface IExamRepository {
  findExamsByClassSection(classSectionId: string): Promise<any[]>;
  findExamById(id: string): Promise<any | null>;
  findMarksByExam(examId: string): Promise<any[]>;
  findMarksByStudent(studentId: string): Promise<any[]>;
  upsertExamMark(data: any): Promise<any>;
  createExam?(data: any): Promise<any>;
  findExamsByTenant?(tenantId: string): Promise<any[]>;
  createExamType?(name: string, tenantId: string): Promise<any>;
  updateExamType?(id: string, name: string, tenantId: string): Promise<any>;
  deleteExamType?(id: string, tenantId: string): Promise<any>;
  findExamTypesByTenant?(tenantId: string): Promise<any[]>;
}
