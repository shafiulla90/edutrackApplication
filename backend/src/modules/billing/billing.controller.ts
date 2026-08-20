import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request } from '@nestjs/common';
import { BillingService } from './billing.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { getTenantIdFromReq } from '../../common/utils/tenant.util';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('products')
  @ApiOperation({ summary: 'Get all fee products' })
  async getProducts(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.getAllFeeProducts(tenantId);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create fee products' })
  async createProducts(@Body() body: any, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    let names: string[] = [];
    if (Array.isArray(body)) {
      names = body;
    } else if (body?.productNames && Array.isArray(body.productNames)) {
      names = body.productNames;
    } else if (body?.name) {
      names = [body.name];
    }
    return this.billingService.createFeeProducts(names, tenantId);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update fee product' })
  async updateProduct(@Param('id') id: string, @Body('name') name: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.updateFeeProduct(id, name, tenantId);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete fee product' })
  async deleteProduct(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.deleteFeeProduct(id, tenantId);
  }

  @Get('pricebook')
  @ApiOperation({ summary: 'Get price book for class and academic year' })
  async getPriceBook(
    @Query('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
    @Request() req: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.getPriceBook(classId, academicYearId, tenantId);
  }

  @Post('pricebook')
  @ApiOperation({ summary: 'Save price book' })
  async savePriceBook(
    @Body('classId') classId: string,
    @Body('academicYearId') academicYearId: string,
    @Body('priceItems') priceItems: any[],
    @Request() req: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.savePriceBook(classId, academicYearId, priceItems || [], tenantId);
  }

  @Get('products/active')
  @ApiOperation({ summary: 'Get active fee products for class' })
  async getActiveProducts(
    @Query('classId') classId: string,
    @Query('academicYearId') academicYearId?: string,
    @Request() req?: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.getActiveProducts(classId, academicYearId, tenantId);
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Create invoice' })
  async createInvoice(
    @Body() body: any,
    @Request() req: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.createInvoice(body, body.items || [], tenantId);
  }

  @Get('invoices/recent')
  @ApiOperation({ summary: 'Get recent invoices' })
  async getRecentInvoices(@Query('studentId') studentId?: string, @Request() req?: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.getRecentInvoices(studentId, tenantId);
  }

  @Get('invoices/:id/pdf')
  @ApiOperation({ summary: 'Get PDF metadata for invoice receipt' })
  async getInvoicePDFData(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.getInvoicePDFData(id, tenantId);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice details by ID' })
  async getInvoiceDetails(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.getInvoiceDetails(id, tenantId);
  }

  @Post('invoices/:id/void')
  @ApiOperation({ summary: 'Void an invoice payment' })
  async voidInvoice(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return { success: true, id, message: 'Invoice voided successfully' };
  }

  @Post('admissions')
  @ApiOperation({ summary: 'Create student admission with fee structure' })
  async createAdmission(
    @Body('studentData') studentData: any,
    @Body('selectedPricebookEntryIds') selectedPricebookEntryIds: string[],
    @Body('concessionAmount') concessionAmount: number,
    @Request() req: any,
  ) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.createAdmission(studentData, selectedPricebookEntryIds || [], concessionAmount || 0, tenantId);
  }

  @Post('discounts')
  async updateDiscount(@Body('oliId') oliId: string, @Body('discountPercent') discountPercent: number) {
    return this.billingService.updateLineItemDiscount(oliId, discountPercent);
  }

  @Post('discounts/bulk')
  async updateDiscountsBulk(@Body('oliIds') oliIds: string[], @Body('discountPercent') discountPercent: number) {
    return this.billingService.updateBulkLineItemDiscounts(oliIds || [], discountPercent);
  }

  @Get('options/years')
  @ApiOperation({ summary: 'Get academic year options for admissions' })
  async getYearsOptions(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.getYearsOptions(tenantId);
  }

  @Get('options/classes')
  @ApiOperation({ summary: 'Get class options for admissions' })
  async getClassesOptions(@Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.getClassesOptions(tenantId);
  }

  @Get('options/sections')
  @ApiOperation({ summary: 'Get section options for admissions' })
  async getSectionsOptions(@Query('classId') classId: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.getSectionsOptions(classId, tenantId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search students for fee payment' })
  async searchStudents(@Query('searchTerm') searchTerm: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.searchStudents(searchTerm, tenantId);
  }

  @Get('students/search')
  @ApiOperation({ summary: 'Search students for fee payment (alias)' })
  async searchStudentsAlias(@Query('searchTerm') searchTerm: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.searchStudents(searchTerm, tenantId);
  }

  @Get('students/:id')
  @ApiOperation({ summary: 'Get student billing account details' })
  async getStudentBillingAccount(@Param('id') id: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.getStudentBillingAccount(id, tenantId);
  }

  @Get('unpaid-fees/:oppId')
  @ApiOperation({ summary: 'Get unpaid fee line items for opportunity' })
  async getUnpaidFees(@Param('oppId') oppId: string, @Request() req: any) {
    const tenantId = getTenantIdFromReq(req);
    return this.billingService.getUnpaidFees(oppId, tenantId);
  }
}
