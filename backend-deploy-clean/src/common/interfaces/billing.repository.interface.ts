export interface IBillingRepository {
  findInvoicesByTenant(tenantId: string, status?: string): Promise<any[]>;
  findPaymentsByTenant?(tenantId: string): Promise<any[]>;
  findInvoiceById(id: string, tenantId?: string): Promise<any | null>;
  findInvoicesByStudent(studentId: string): Promise<any[]>;
  createInvoice(invoiceData: any, items: any[]): Promise<any>;
  updateInvoiceStatus(id: string, status: string, paidAmount?: number): Promise<any>;
  findExpensesByTenant(tenantId: string): Promise<any[]>;
  createExpense(data: any): Promise<any>;
  updateExpense?(id: string, data: any, tenantId?: string): Promise<any>;
  deleteExpense?(id: string, tenantId?: string): Promise<any>;
  createFeeProducts?(productNames: string[], tenantId: string): Promise<any[]>;
  getAllFeeProducts?(tenantId: string): Promise<any[]>;
  updateFeeProduct?(id: string, name: string, tenantId: string): Promise<any>;
  deleteFeeProduct?(id: string, tenantId: string): Promise<any>;
  savePriceBook?(classId: string, academicYearId: string, priceItems: any[], tenantId: string): Promise<any>;
  getPriceBook?(classId: string, academicYearId: string, tenantId: string): Promise<any[]>;
}
