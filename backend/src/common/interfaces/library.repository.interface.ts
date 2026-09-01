export interface ILibraryRepository {
  findBooksByTenant(tenantId: string): Promise<any[]>;
  findBookById(id: string): Promise<any | null>;
  findCopiesByBook(bookId: string): Promise<any[]>;
  findBookIssuesByBorrower(borrowerId: string): Promise<any[]>;
  issueBook(data: any): Promise<any>;
  returnBook(issueId: string, returnDate: Date): Promise<any>;
}
