export interface IPlatformAdminRepository {
  getSettings(): Promise<any | null>;
  updateSettings(id: string, data: any): Promise<any>;
  getGatewayConfigs(): Promise<any[]>;
  updateGatewayConfig(id: string, data: any): Promise<any>;
}
