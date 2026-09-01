export interface ITimetableRepository {
  findPeriodTimings(tenantId: string): Promise<any[]>;
  findPeriodsByClassSection(classSectionId: string): Promise<any[]>;
  findPeriodsByTeacher(teacherId: string): Promise<any[]>;
  createPeriod(data: any): Promise<any>;
  updatePeriod(id: string, data: any): Promise<any>;
  deletePeriod(id: string): Promise<any>;
}
