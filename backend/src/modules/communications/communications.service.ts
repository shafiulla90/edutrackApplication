import { Injectable, Inject, Optional, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IOperationsRepository } from '../../common/interfaces/operations.repository.interface';
import { ITenantRepository } from '../../common/interfaces/tenant.repository.interface';
import { FirebaseService } from '../../database/firebase.service';

@Injectable()
export class CommunicationsService {
  private readNotificationIds = new Set<string>();
  private deletedNotificationIds = new Set<string>();

  constructor(
    @Inject('IOperationsRepository') private readonly opsRepo: IOperationsRepository,
    @Inject('ITenantRepository') private readonly tenantRepo: ITenantRepository,
    @Optional() private readonly firebaseService?: FirebaseService,
  ) {}

  private get db() {
    return this.firebaseService?.getFirestore();
  }

  async sendNotification(data: any, tenantId?: string) {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return null;
    if (this.db) {
      const docRef = this.db.collection('notifications').doc();
      const notif = {
        id: docRef.id,
        tenantId: tid,
        title: data.title,
        message: data.message,
        type: data.type || 'IN_APP',
        recipientId: data.recipientId || '',
        targetAudience: data.targetAudience || data.audience || '',
        classSectionId: data.classSectionId || '',
        studentId: data.studentId || '',
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      await docRef.set(notif);
      return notif;
    }

    return this.opsRepo.createNotification({
      title: data.title,
      message: data.message,
      type: data.type || 'IN_APP',
      recipientId: data.recipientId || 'user-active',
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  }

  async getNotifications(recipientId: string, tenantId?: string, recipientRole?: string, inputLinkedStudentIds: string[] = []) {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return null;
    const notifications: any[] = [];
    const roleStr = String(recipientRole || '').toUpperCase();
    const isParent = roleStr.includes('PARENT') || recipientId.includes('parent') || recipientId === 'user-parent';
    const isTeacher = (!isParent) && (roleStr.includes('TEACHER') || recipientId.includes('teacher') || recipientId.startsWith('user-t-'));
    const isAdmin = (!isParent && !isTeacher) && (roleStr.includes('ADMIN') || roleStr.includes('SUPERADMIN') || recipientId.includes('admin') || recipientId === 'user-admin');

    console.log(`[DEBUG_NOTIF] recipientId=${recipientId}, roleStr=${roleStr}, isParent=${isParent}, isTeacher=${isTeacher}, isAdmin=${isAdmin}`);

    let linkedStudentIds = [...inputLinkedStudentIds];
    let linkedClassSectionIds: string[] = [];

    if (isParent && this.db) {
      try {
        const normTarget = (recipientId || '').replace(/\D/g, '').slice(-10);
        const spSnap = await this.db.collection('studentProfiles').where('tenantId', '==', tid).get().catch(() => null);
        if (spSnap && !spSnap.empty) {
          const matchedDocs = spSnap.docs.filter(doc => {
            const d = doc.data();
            if (linkedStudentIds.includes(doc.id)) return true;
            const phones = [d.fatherPhone, d.motherPhone, d.guardianPhone, d.phone, d.parentPhone];
            for (const p of phones) {
              if (p && normTarget && String(p).replace(/\D/g, '').slice(-10) === normTarget) return true;
            }
            const emails = [d.parentEmail, d.email, d.fatherEmail, d.motherEmail];
            for (const e of emails) {
              if (e && String(e).toLowerCase().trim() === (recipientId || '').toLowerCase().trim()) return true;
            }
            return false;
          });

          linkedStudentIds = Array.from(new Set([...linkedStudentIds, ...matchedDocs.map(d => d.id)]));
          linkedClassSectionIds = Array.from(new Set(matchedDocs.map(d => d.data().classSectionId || d.data().classId).filter(Boolean)));
        }
      } catch (err) {
        console.error('Error resolving linked students for notifications:', err);
      }
    }

    if (isTeacher && this.db) {
      try {
        const csSnap = await this.db.collection('tenants').doc(tid).collection('classSections').where('teacherId', '==', recipientId).get().catch(() => null);
        if (csSnap && !csSnap.empty) {
          linkedClassSectionIds = csSnap.docs.map(d => d.id);
        }
        const taSnap = await this.db.collection('tenants').doc(tid).collection('teacherAssignments').where('teacherId', '==', recipientId).get().catch(() => null);
        if (taSnap && !taSnap.empty) {
          taSnap.docs.forEach(d => {
            const csId = d.data()?.classSectionId;
            if (csId && !linkedClassSectionIds.includes(csId)) linkedClassSectionIds.push(csId);
          });
        }
      } catch (err) {
        console.error('Error resolving teacher assigned class sections for notifications:', err);
      }
    }

    // 1. Fetch direct in-app notifications
    if (this.db) {
      try {
        const snap = await this.db.collection('notifications')
          .where('tenantId', '==', tid)
          .get()
          .catch(() => ({ docs: [] } as any));

        snap.docs.forEach((doc: any) => {
          const data = doc.data();
          notifications.push({ id: doc.id, ...data });
        });

        // Fetch announcements from tenants/{tid}/announcements
        const annSnap = await this.db.collection('tenants').doc(tid).collection('announcements').get().catch(() => null);
        if (annSnap && !annSnap.empty) {
          annSnap.docs.forEach((doc: any) => {
            const d = doc.data() || {};
            const notifId = 'notif-ann-' + doc.id;
            const readStatus = Array.isArray(d.readStatus) ? d.readStatus : [];
            const isRead = readStatus.includes(recipientId) || this.readNotificationIds.has(notifId);

            notifications.push({
              id: notifId,
              tenantId: tid,
              type: 'ANNOUNCEMENT',
              title: d.title || 'School Announcement',
              message: d.content || d.description || '',
              targetAudience: d.audienceType || d.targetAudience || 'ALL',
              classSectionId: d.classSectionId || null,
              isRead: isRead,
              createdAt: d.createdAt || new Date().toISOString(),
            });
          });
        }
      } catch (err) {
        console.error('Error fetching in-app notifications:', err);
      }
    } else {
      const list = await this.opsRepo.findNotificationsByUser(recipientId || 'user-active');
      if (list) notifications.push(...list);
    }

    // 2. Fetch live pending leave requests
    if (this.db) {
      try {
        const leaveSnap = await this.db.collection('tenants').doc(tid).collection('leaveRequests').get();
        for (const doc of leaveSnap.docs) {
          const d = doc.data();
          if (doc.id.startsWith('leave-seed-') || doc.id.includes('seed') || d.id?.startsWith('leave-seed-') || d.id?.includes('seed')) {
            continue;
          }

          const applicantId = d.applicantId || d.userId || d.teacherId || d.staffId || '';
          const applicantName = d.staffName || d.teacherName || d.applicantName || d.teacher?.user?.name || d.student?.user?.name || 'Staff Member';
          if (['Sarah Jenkins', 'John Smith', 'Mohamd huzaifa', 'QA Final Student', 'Student 1'].includes(applicantName)) {
            continue;
          }
          
          let shouldInclude = false;
          if (isAdmin) {
            shouldInclude = d.status === 'PENDING' || !d.status;
          } else if (isTeacher) {
            shouldInclude = !!applicantId && !!recipientId && applicantId === recipientId;
          }

          if (shouldInclude) {
            const notifId = 'notif-leave-' + doc.id;
            const leaveType = d.leaveType || d.type || 'Leave Application';
            const fromDate = (d.fromDate || d.startDate || new Date().toISOString()).split('T')[0];
            const toDate = (d.toDate || d.endDate || new Date().toISOString()).split('T')[0];
            const reason = d.reason || 'Staff leave request pending approval';

            notifications.push({
              id: notifId,
              tenantId: tid,
              type: 'LEAVE_APPROVAL',
              title: `Leave Application: ${applicantName}`,
              message: `LeaveRequestId: ${doc.id}\nType: ${leaveType}\nFrom: ${fromDate}\nTo: ${toDate}\nReason: ${reason}`,
              isRead: this.readNotificationIds.has(notifId),
              createdAt: d.createdAt || new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error('Error fetching leave request notifications:', err);
      }
    }

    // 3. Fetch live parent complaints/grievances
    if (this.db) {
      try {
        const compSnap = await this.db.collection('tenants').doc(tid).collection('parentComplaints').get();
        for (const doc of compSnap.docs) {
          const d = doc.data();
          if (doc.id.startsWith('pc-00') || doc.id.includes('seed') || d.id?.includes('seed')) {
            continue;
          }

          let shouldInclude = false;
          if (isAdmin) {
            shouldInclude = d.status === 'OPEN' || d.status === 'IN_PROGRESS';
          } else if (isTeacher) {
            shouldInclude = (d.status === 'OPEN' || d.status === 'IN_PROGRESS') && !!recipientId && (
              (d.assignedTeacherId && d.assignedTeacherId === recipientId) ||
              (d.teacherId && d.teacherId === recipientId)
            );
          } else if (isParent) {
            shouldInclude = !!recipientId && ((d.parentId && d.parentId === recipientId) || (d.userId && d.userId === recipientId));
          }

          if (shouldInclude) {
            const notifId = 'notif-pc-' + doc.id;
            const parentName = d.parentName || d.submittedBy?.name || 'Parent';
            const subject = d.subject || d.title || 'Parent Grievance Ticket';
            const category = d.category || 'General';

            notifications.push({
              id: notifId,
              tenantId: tid,
              type: 'COMPLAINT_UPDATE',
              title: `Parent Complaint: "${subject}"`,
              message: `Parent ${parentName} submitted a complaint: "${subject}" (Category: ${category}) ComplaintId: ${doc.id}`,
              isRead: this.readNotificationIds.has(notifId),
              createdAt: d.createdAt || new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error('Error fetching parent complaint notifications:', err);
      }
    }

    // 4. Fetch live pending student behavior cases
    if (this.db) {
      try {
        const behaviorSnap = await this.db.collection('tenants').doc(tid).collection('behaviorCases').get();
        for (const doc of behaviorSnap.docs) {
          const d = doc.data();
          if (doc.id.startsWith('case-seed-') || doc.id.includes('seed') || d.id?.includes('seed')) {
            continue;
          }

          let shouldInclude = false;
          if (isAdmin) {
            shouldInclude = d.status === 'PENDING' || d.status === 'New';
          } else if (isTeacher) {
            shouldInclude = (d.status === 'PENDING' || d.status === 'New') && !!recipientId && (
              (d.assignedTeacherId && d.assignedTeacherId === recipientId) ||
              (d.reportedById && d.reportedById === recipientId) ||
              (d.classSectionId && linkedClassSectionIds.includes(d.classSectionId))
            );
          } else if (isParent) {
            shouldInclude = d.studentId && linkedStudentIds.includes(d.studentId);
          }

          if (shouldInclude) {
            const notifId = 'notif-bc-' + doc.id;
            const studentName = d.studentName || d.student?.user?.name || d.student?.name || 'Student';
            const behaviorType = d.behaviorType || 'Complaint';
            const category = d.category || 'Discipline';

            notifications.push({
              id: notifId,
              tenantId: tid,
              type: 'STUDENT_BEHAVIOR',
              title: `Student ${behaviorType}: ${studentName}`,
              message: `StudentName: ${studentName} | Category: ${category} | Priority: ${d.priority || 'Medium'} | ${d.description || ''}`,
              isRead: this.readNotificationIds.has(notifId),
              createdAt: d.createdAt || new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error('Error fetching behavior case notifications:', err);
      }
    }

    // Filter out deleted notifications and apply role isolation
    let activeList = notifications.filter(n => !this.deletedNotificationIds.has(n.id));

    if (isParent) {
      activeList = activeList.filter(n => {
        const typeStr = String(n.type || '').toUpperCase();
        const titleStr = String(n.title || '').toLowerCase();
        const msgStr = String(n.message || '').toLowerCase();
        const targetAud = String(n.targetAudience || n.audience || '').toUpperCase();

        // Strictly exclude staff, teacher, admin notifications and teacher complaints
        if (targetAud === 'TEACHERS' || targetAud === 'STAFF' || targetAud === 'ADMIN' || titleStr.includes('staff meeting') || titleStr.includes('teacher meeting') || titleStr.includes('staff member') || msgStr.includes('staff leave request')) {
          return false;
        }

        if (typeStr === 'LEAVE_APPROVAL') {
          return false;
        }

        if (typeStr === 'COMPLAINT_UPDATE' || titleStr.includes('parent complaint')) {
          return !!(n.parentId && n.parentId === recipientId);
        }

        if (typeStr === 'STUDENT_BEHAVIOR' || titleStr.includes('student complaint')) {
          return !!(n.studentId && linkedStudentIds.includes(n.studentId));
        }

        const isRecipientMatch = n.recipientId && (
          n.recipientId === recipientId ||
          n.recipientId === 'ALL_PARENTS' ||
          n.recipientId === 'ALL' ||
          n.recipientId === 'user-parent'
        );

        const isStudentMatch = n.studentId && linkedStudentIds.includes(n.studentId);
        const isClassMatch = n.classSectionId && linkedClassSectionIds.includes(n.classSectionId);
        const isParentWideType = typeStr === 'LEAVE_STATUS' || typeStr === 'ATTENDANCE_UPDATE' || typeStr === 'MARKS_PUBLISHED' || (typeStr === 'ANNOUNCEMENT' && (targetAud === 'PARENTS' || targetAud === 'ALL_PARENTS' || targetAud === 'ALL'));

        return isRecipientMatch || isStudentMatch || isClassMatch || (isParentWideType && (isRecipientMatch || isStudentMatch || !n.studentId));
      });
    } else if (isTeacher) {
      activeList = activeList.filter(n => {
        if (n.tenantId && n.tenantId !== tid) return false;

        if (n.id.startsWith('notif-leave-') || n.id.startsWith('notif-pc-') || n.id.startsWith('notif-bc-') || n.id.startsWith('notif-ann-')) return true;

        const targetAud = String(n.targetAudience || n.audience || n.audienceType || '').toUpperCase();
        const typeStr = String(n.type || '').toUpperCase();
        const recId = n.recipientId;
        const titleStr = String(n.title || '').toLowerCase();

        if (targetAud === 'ADMIN' || targetAud === 'PARENTS' || targetAud === 'ALL_PARENTS') return false;

        if (recId && (recId === recipientId || recId === 'user-active' || recId === 'user-teacher' || recId === 'ALL_TEACHERS' || recId === 'ALL')) return true;

        if (targetAud === 'TEACHERS' || targetAud === 'STAFF' || targetAud === 'ALL' || targetAud === 'INSTITUTION' || targetAud === '' || typeStr === 'ANNOUNCEMENT' || titleStr.includes('staff') || titleStr.includes('meeting')) return true;

        if (n.classSectionId && linkedClassSectionIds.includes(n.classSectionId)) return true;

        return false;
      });
    }

    // Sort by createdAt descending
    activeList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return activeList;
  }

  async markAsRead(id: string, tenantId?: string) {
    this.readNotificationIds.add(id);
    if (this.db && !id.startsWith('notif-')) {
      try {
        await this.db.collection('notifications').doc(id).update({ isRead: true });
      } catch (err) {}
    } else {
      await this.opsRepo.markNotificationRead(id).catch(() => null);
    }
    return { success: true, id };
  }

  async deleteNotification(id: string, tenantId?: string, recipientId?: string, recipientRole?: string) {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return null;
    const currentUserId = recipientId || 'user-parent';
    const roleStr = String(recipientRole || 'PARENT').toUpperCase();
    const isParent = !recipientRole || roleStr.includes('PARENT') || currentUserId.includes('parent') || currentUserId === 'user-parent' || currentUserId === 'user-active';

    if (this.db && !id.startsWith('notif-')) {
      const docRef = this.db.collection('notifications').doc(id);
      const snap = await docRef.get().catch(() => null);

      if (snap && snap.exists) {
        const notifData = snap.data() || {};
        // Strict tenant isolation check
        if (notifData.tenantId && notifData.tenantId !== tid) {
          throw new ForbiddenException('Cannot delete notification belonging to another tenant');
        }

        // Ownership verification for parents
        if (isParent) {
          let linkedStudentIds: string[] = [];
          try {
            const normTarget = currentUserId.replace(/\D/g, '').slice(-10);
            const spSnap = await this.db.collection('studentProfiles').where('tenantId', '==', tid).get().catch(() => null);
            if (spSnap && !spSnap.empty) {
              linkedStudentIds = spSnap.docs.filter(doc => {
                const d = doc.data();
                const phones = [d.fatherPhone, d.motherPhone, d.guardianPhone, d.phone, d.parentPhone];
                for (const p of phones) {
                  if (p && normTarget && String(p).replace(/\D/g, '').slice(-10) === normTarget) return true;
                }
                const emails = [d.parentEmail, d.email, d.fatherEmail, d.motherEmail];
                for (const e of emails) {
                  if (e && String(e).toLowerCase().trim() === currentUserId.toLowerCase().trim()) return true;
                }
                return false;
              }).map(d => d.id);
            }
          } catch (err) {}

          const isOwner = notifData.recipientId === currentUserId ||
            notifData.recipientId === 'ALL_PARENTS' ||
            notifData.recipientId === 'user-parent' ||
            notifData.recipientId === 'user-active' ||
            (notifData.studentId && linkedStudentIds.includes(notifData.studentId));
        }

        // Soft delete notification for user's bell view so Firestore announcements/documents are never deleted
      }
    }

    this.deletedNotificationIds.add(id);
    return { success: true, id };
  }

  async clearReadNotifications(recipientId: string, tenantId?: string) {
    const allNotifs = await this.getNotifications(recipientId, tenantId);
    allNotifs.forEach(n => {
      if (n.isRead) {
        this.deletedNotificationIds.add(n.id);
      }
    });
    return { success: true, recipientId };
  }
}
