export interface ITenantRepository {
  findAll(): Promise<any[]>;
  findById(id: string): Promise<any | null>;
  findBySubdomain(subDomain: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  delete(id: string): Promise<any>;
}
