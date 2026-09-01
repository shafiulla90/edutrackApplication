import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FirebaseService } from '../../database/firebase.service';
import { randomUUID } from 'crypto';

function sanitizePayload(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      clean[key] = sanitizePayload(obj[key]);
    }
  }
  return clean;
}

@ApiTags('Exam Schedule')
@Controller('exam-schedule')
export class ExamScheduleController {
  constructor(
    @Inject(FirebaseService) private readonly firebase: FirebaseService
  ) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  @Get()
  @ApiOperation({ summary: 'Get all exam schedules for tenant' })
  async findAll(
    @Query('classSectionId') classSectionId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('search') search?: string,
    @Request() req?: any,
  ) {
    const tid = req?.user?.tenantId || 'tenant-test-001';

    try {
      const snap = await this.db
        .collection('tenants')
        .doc(tid)
        .collection('examSchedules')
        .get();

      let items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      if (classSectionId && classSectionId !== 'All') {
        items = items.filter((i: any) => i.classSectionId === classSectionId);
      }
      if (academicYearId && academicYearId !== 'All') {
        items = items.filter((i: any) => i.academicYearId === academicYearId);
      }
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        items = items.filter(
          (i: any) =>
            (i.examName && i.examName.toLowerCase().includes(q)) ||
            (i.subject && i.subject.toLowerCase().includes(q)) ||
            (i.room && i.room.toLowerCase().includes(q))
        );
      }

      return { data: items, total: items.length };
    } catch (err) {
      console.error('Error fetching exam schedules:', err);
      return { data: [], total: 0 };
    }
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create exam schedules in bulk' })
  async bulkCreate(@Body() body: any, @Request() req?: any) {
    const tid = req?.user?.tenantId || 'tenant-test-001';
    const rawSchedules = Array.isArray(body?.schedules) ? body.schedules : [body];

    if (rawSchedules.length === 0) {
      throw new BadRequestException('At least one exam schedule is required.');
    }

    const saved: any[] = [];
    const batch = this.db.batch();

    for (const item of rawSchedules) {
      const examName = (item.examName || item.examTerm || '').trim();
      const classSectionId = (item.classSectionId || '').trim();
      const academicYearId = (item.academicYearId || '').trim();
      const subject = (item.subject || item.subjectId || '').trim();
      const date = item.date || item.examDate;
      const startTime = item.startTime;
      const endTime = item.endTime;

      if (!examName) {
        throw new BadRequestException('Exam Name / Term is required.');
      }
      if (!classSectionId) {
        throw new BadRequestException('Class & Section is required.');
      }
      if (!academicYearId) {
        throw new BadRequestException('Academic Year is required.');
      }
      if (!subject) {
        throw new BadRequestException('Subject is required.');
      }
      if (!date) {
        throw new BadRequestException('Exam Date is required.');
      }
      if (!startTime || !endTime) {
        throw new BadRequestException('Start Time and End Time are required.');
      }

      const id = item.id || randomUUID();
      const payload = sanitizePayload({
        ...item,
        id,
        tenantId: tid,
        examName,
        classSectionId,
        academicYearId,
        subject,
        date: String(date),
        startTime,
        endTime,
        room: item.room || item.hall || 'Hall-1',
        instructions: item.instructions || item.specialInstructions || '',
        status: item.status || 'Scheduled',
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const ref = this.db
        .collection('tenants')
        .doc(tid)
        .collection('examSchedules')
        .doc(id);

      batch.set(ref, payload, { merge: true });
      saved.push(payload);
    }

    await batch.commit();
    return { success: true, count: saved.length, data: saved };
  }

  @Patch('bulk')
  @ApiOperation({ summary: 'Bulk update exam schedules status' })
  async bulkUpdateStatus(@Body() body: any, @Request() req?: any) {
    const tid = req?.user?.tenantId || 'tenant-test-001';
    const ids: string[] = body?.ids || [];
    const status = body?.status || 'Published';

    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: true, count: 0 };
    }

    const batch = this.db.batch();
    for (const id of ids) {
      const ref = this.db
        .collection('tenants')
        .doc(tid)
        .collection('examSchedules')
        .doc(id);
      batch.update(ref, { status, updatedAt: new Date().toISOString() });
    }

    await batch.commit();
    return { success: true, count: ids.length };
  }

  @Post('bulk-delete')
  @ApiOperation({ summary: 'Bulk delete exam schedules' })
  async bulkDelete(@Body() body: any, @Request() req?: any) {
    const tid = req?.user?.tenantId || 'tenant-test-001';
    const ids: string[] = body?.ids || [];

    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: true, count: 0 };
    }

    const batch = this.db.batch();
    for (const id of ids) {
      const ref = this.db
        .collection('tenants')
        .doc(tid)
        .collection('examSchedules')
        .doc(id);
      batch.delete(ref);
    }

    await batch.commit();
    return { success: true, count: ids.length };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update exam schedule' })
  async updateOne(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req?: any
  ) {
    const tid = req?.user?.tenantId || 'tenant-test-001';
    const ref = this.db
      .collection('tenants')
      .doc(tid)
      .collection('examSchedules')
      .doc(id);

    const payload = sanitizePayload({
      ...body,
      updatedAt: new Date().toISOString(),
    });

    await ref.set(payload, { merge: true });
    return { success: true, id, ...payload };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete exam schedule' })
  async deleteOne(@Param('id') id: string, @Request() req?: any) {
    const tid = req?.user?.tenantId || 'tenant-test-001';
    const ref = this.db
      .collection('tenants')
      .doc(tid)
      .collection('examSchedules')
      .doc(id);

    await ref.delete();
    return { success: true, id };
  }
}
