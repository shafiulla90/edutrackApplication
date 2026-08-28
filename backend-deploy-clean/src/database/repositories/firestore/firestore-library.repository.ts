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

  async findBookById(id: string, tenantId?: string): Promise<any | null> {
    if (tenantId) {
      const docRef = this.db.collection('tenants').doc(tenantId).collection('books').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return null;
      const data = { id: doc.id, ...doc.data() };
      const copiesSnap = await docRef.collection('bookCopies').get();
      return {
        ...data,
        BookCopy: copiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      };
    }
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

  async findBookIssuesByBorrower(borrowerId: string, tenantId?: string): Promise<any[]> {
    if (tenantId) {
      const snap = await this.db.collection('tenants').doc(tenantId).collection('bookIssues').where('borrowerId', '==', borrowerId).get();
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }
    const snap = await this.db.collectionGroup('bookIssues').where('borrowerId', '==', borrowerId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async issueBook(data: any): Promise<any> {
    if (!data.tenantId) throw new Error('tenantId is required');
    const tenantId = data.tenantId;
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

  async returnBook(issueId: string, returnDate: Date, tenantId?: string): Promise<any> {
    if (tenantId) {
      const docRef = this.db.collection('tenants').doc(tenantId).collection('bookIssues').doc(issueId);
      const doc = await docRef.get();
      if (doc.exists) {
        await docRef.set({ returnDate: formatDateISO(returnDate) }, { merge: true });
        return { id: issueId, ...doc.data(), returnDate: formatDateISO(returnDate) };
      }
    }
    const snap = await this.db.collectionGroup('bookIssues').where('id', '==', issueId).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    await doc.ref.set({ returnDate: formatDateISO(returnDate) }, { merge: true });
    return { id: issueId, ...doc.data(), returnDate: formatDateISO(returnDate) };
  }
}
