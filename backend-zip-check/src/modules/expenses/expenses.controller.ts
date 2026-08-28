import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Expenses')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Create new expense' })
  async create(@Body() data: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.expensesService.createExpense(data, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all expenses' })
  async getAll(
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.expensesService.getExpenses(category, status, tenantId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get expense summary' })
  async getSummary(@Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.expensesService.getExpenseSummary(tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update expense' })
  async update(@Param('id') id: string, @Body() data: any, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.expensesService.updateExpense(id, data, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete expense' })
  async remove(@Param('id') id: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.expensesService.deleteExpense(id, tenantId);
  }
}
