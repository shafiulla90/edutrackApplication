export interface IStudentRepository {
  findProfileById(id: string): Promise<any | null>;
  findProfileByUserId(userId: string): Promise<any | null>;
  findStudentsByClassSection(classSectionId: string): Promise<any[]>;
  findStudentsByTenant(tenantId: string, page?: number, limit?: number, filters?: any): Promise<{ items: any[]; total: number }>;
  createProfile(data: any): Promise<any>;
  updateProfile(id: string, data: any): Promise<any>;
  deleteProfile?(id: string): Promise<any>;
  findStudentsByParent?(parentIdentifier: string, tenantId: string): Promise<any[]>;
}
