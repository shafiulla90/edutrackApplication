export interface ILibraryRepository {
  findBooksByTenant(tenantId: string): Promise<any[]>;
  findBookById(id: string, tenantId?: string): Promise<any | null>;
  findCopiesByBook(bookId: string, tenantId?: string): Promise<any[]>;
  findBookIssuesByBorrower(borrowerId: string, tenantId?: string): Promise<any[]>;
  issueBook(data: any): Promise<any>;
  returnBook(issueId: string, returnDate: Date, tenantId?: string): Promise<any>;
}
