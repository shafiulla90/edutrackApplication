import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase.service';
import { ILibraryRepository } from '../../../common/interfaces/library.repository.interface';
import { formatDateISO } from '../../../common/utils/migration-helpers';

@Injectable()
export class FirestoreLibraryRepository implements ILibraryRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  async findBooksByTenant(tenantId: string): Promise<any[]> {
    const snap = await this.db.collection('tenants').doc(tenantId).collection('books').get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findBookById(id: string): Promise<any | null> {
    const snap = await this.db.collectionGroup('books').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = { id: doc.id, ...doc.data() };
    const copiesSnap = await doc.ref.collection('bookCopies').get();
    return {
      ...data,
      BookCopy: copiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }

  async findCopiesByBook(bookId: string): Promise<any[]> {
    const snap = await this.db.collectionGroup('bookCopies').where('bookId', '==', bookId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findBookIssuesByBorrower(borrowerId: string): Promise<any[]> {
    const snap = await this.db.collectionGroup('bookIssues').where('borrowerId', '==', borrowerId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async issueBook(data: any): Promise<any> {
    const tenantId = data.tenantId || 'tenant-test-001';
    const ref = data.id ? this.db.collection('tenants').doc(tenantId).collection('bookIssues').doc(data.id) : this.db.collection('tenants').doc(tenantId).collection('bookIssues').doc();
    const payload = {
      ...data,
      id: ref.id,
      tenantId,
      issueDate: formatDateISO(data.issueDate),
      dueDate: formatDateISO(data.dueDate),
    };
    await ref.set(payload, { merge: true });
    return payload;
  }

  async returnBook(issueId: string, returnDate: Date): Promise<any> {
    const snap = await this.db.collectionGroup('bookIssues').where('id', '==', issueId).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    await doc.ref.set({ returnDate: formatDateISO(returnDate) }, { merge: true });
    return { id: issueId, ...doc.data(), returnDate: formatDateISO(returnDate) };
  }
}
