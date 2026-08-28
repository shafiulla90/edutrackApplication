import { Module, Global } from '@nestjs/common';
import { FirebaseModule } from './firebase.module';
import { FirebaseService } from './firebase.service';

import { FirestoreUserRepository } from './repositories/firestore/firestore-user.repository';
import { FirestoreTenantRepository } from './repositories/firestore/firestore-tenant.repository';
import { FirestoreAcademicRepository } from './repositories/firestore/firestore-academic.repository';
import { FirestoreStudentRepository } from './repositories/firestore/firestore-student.repository';
import { FirestoreTeacherRepository } from './repositories/firestore/firestore-teacher.repository';
import { FirestoreTimetableRepository } from './repositories/firestore/firestore-timetable.repository';
import { FirestoreAttendanceRepository } from './repositories/firestore/firestore-attendance.repository';
import { FirestoreExamRepository } from './repositories/firestore/firestore-exam.repository';
import { FirestoreBillingRepository } from './repositories/firestore/firestore-billing.repository';
import { FirestoreSubscriptionRepository } from './repositories/firestore/firestore-subscription.repository';
import { FirestorePlatformAdminRepository } from './repositories/firestore/firestore-platform-admin.repository';
import { FirestoreLibraryRepository } from './repositories/firestore/firestore-library.repository';
import { FirestoreOperationsRepository } from './repositories/firestore/firestore-operations.repository';

const repositoryProviders = [
  {
    provide: 'IUserRepository',
    useFactory: (firebase: FirebaseService) => new FirestoreUserRepository(firebase),
    inject: [FirebaseService],
  },
  {
    provide: 'ITenantRepository',
    useFactory: (firebase: FirebaseService) => new FirestoreTenantRepository(firebase),
    inject: [FirebaseService],
  },
  {
    provide: 'IAcademicRepository',
    useFactory: (firebase: FirebaseService) => new FirestoreAcademicRepository(firebase),
    inject: [FirebaseService],
  },
  {
    provide: 'IStudentRepository',
    useFactory: (firebase: FirebaseService) => new FirestoreStudentRepository(firebase),
    inject: [FirebaseService],
  },
  {
    provide: 'ITeacherRepository',
    useFactory: (firebase: FirebaseService) => new FirestoreTeacherRepository(firebase),
    inject: [FirebaseService],
  },
  {
    provide: 'ITimetableRepository',
    useFactory: (firebase: FirebaseService) => new FirestoreTimetableRepository(firebase),
    inject: [FirebaseService],
  },
  {
    provide: 'IAttendanceRepository',
    useFactory: (firebase: FirebaseService) => new FirestoreAttendanceRepository(firebase),
    inject: [FirebaseService],
  },
  {
    provide: 'IExamRepository',
    useFactory: (firebase: FirebaseService) => new FirestoreExamRepository(firebase),
    inject: [FirebaseService],
  },
  {
    provide: 'IBillingRepository',
    useFactory: (firebase: FirebaseService) => new FirestoreBillingRepository(firebase),
    inject: [FirebaseService],
  },
  {
    provide: 'ISubscriptionRepository',
    useFactory: (firebase: FirebaseService) => new FirestoreSubscriptionRepository(firebase),
    inject: [FirebaseService],
  },
  {
    provide: 'IPlatformAdminRepository',
    useFactory: (firebase: FirebaseService) => new FirestorePlatformAdminRepository(firebase),
    inject: [FirebaseService],
  },
  {
    provide: 'ILibraryRepository',
    useFactory: (firebase: FirebaseService) => new FirestoreLibraryRepository(firebase),
    inject: [FirebaseService],
  },
  {
    provide: 'IOperationsRepository',
    useFactory: (firebase: FirebaseService) => new FirestoreOperationsRepository(firebase),
    inject: [FirebaseService],
  },
];

@Global()
@Module({
  imports: [FirebaseModule],
  providers: [...repositoryProviders],
  exports: [...repositoryProviders, FirebaseModule],
})
export class DatabaseProviderModule {}
