export interface IUserRepository {
  findById(id: string): Promise<any | null>;
  findByEmail(email: string): Promise<any | null>;
  findByPhone?(phone: string, portal?: string): Promise<any | null>;
  findAnyUserByPhone?(phone: string): Promise<any | null>;
  findUserWithProfile(id: string): Promise<any | null>;
  findUsersByTenant(tenantId: string, role?: string): Promise<any[]>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  delete(id: string): Promise<any>;
}
