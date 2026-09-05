import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { AuthedRequest } from '../auth/jwt.guard';
import { ReportsService } from './reports.service';
import { restrictCompanyIds } from '../common/company-filter.util';

@Controller('reports')
@UseGuards(JwtGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sale')
  getSale(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('partyId') partyId?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getSaleReport(req.tenantId, from, to, status, partyId, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('purchase')
  getPurchase(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('partyId') partyId?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getPurchaseReport(req.tenantId, from, to, status, partyId, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('day-book')
  getDayBook(
    @Req() req: AuthedRequest,
    @Query('date') date?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getDayBook(req.tenantId, date, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('all-transactions')
  getAllTransactions(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('txnType') txnType?: string,
    @Query('paymentType') paymentType?: string,
    @Query('status') status?: string,
    @Query('partyId') partyId?: string,
    @Query('companyId') companyId?: string,
    @Query('bookerId') bookerId?: string,
  ) {
    return this.reports.getAllTransactions(req.tenantId, from, to, txnType, paymentType, status, partyId, restrictCompanyIds(companyId, req.companyIds), bookerId);
  }

  @Get('profit-and-loss')
  getProfitAndLoss(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getProfitAndLoss(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('cash-flow')
  getCashFlow(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getCashFlow(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('party-statement')
  getPartyStatement(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('partyId') partyId?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getPartyStatement(req.tenantId, from, to, partyId, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('all-parties')
  getAllParties(
    @Req() req: AuthedRequest,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getAllParties(req.tenantId, restrictCompanyIds(companyId, req.companyIds), from, to);
  }

  @Get('party-report-by-item')
  getPartyReportByItem(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getPartyReportByItem(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('item-report-by-party')
  getItemReportByParty(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
    @Query('bookerId') bookerId?: string,
  ) {
    return this.reports.getItemReportByParty(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds), bookerId);
  }

  @Get('sale-purchase-by-party')
  getSalePurchaseByParty(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getSalePurchaseByParty(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('sale-purchase-by-party-group')
  getSalePurchaseByPartyGroup(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getSalePurchaseByPartyGroup(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('stock-summary')
  getStockSummary(
    @Req() req: AuthedRequest,
    @Query('asOf') asOf?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getStockSummary(req.tenantId, asOf, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('low-stock')
  getLowStock(@Req() req: AuthedRequest, @Query('companyId') companyId?: string) {
    return this.reports.getLowStock(req.tenantId, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('stock-detail')
  getStockDetail(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getStockDetail(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('item-detail')
  getItemDetail(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('itemName') itemName?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getItemDetail(req.tenantId, from, to, itemName, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('item-wise-pnl')
  getItemWisePnl(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getItemWisePnl(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('item-category-pnl')
  getItemCategoryPnl(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getItemCategoryPnl(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('sale-purchase-by-item-category')
  getSalePurchaseByItemCategory(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getSalePurchaseByItemCategory(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('stock-summary-by-category')
  getStockSummaryByCategory(@Req() req: AuthedRequest, @Query('companyId') companyId?: string) {
    return this.reports.getStockSummaryByCategory(req.tenantId, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('item-wise-discount')
  getItemWiseDiscount(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getItemWiseDiscount(req.tenantId, from, to);
  }

  @Get('bank-statement')
  getBankStatement(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getBankStatement(req.tenantId, from, to);
  }

  @Get('discount-report')
  getDiscountReport(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getDiscountReport(req.tenantId, from, to);
  }

  @Get('tax-report')
  getTaxReport(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getTaxReport(req.tenantId, from, to);
  }

  @Get('tax-rate-report')
  getTaxRateReport(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getTaxRateReport(req.tenantId, from, to);
  }

  @Get('expense')
  getExpense(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getExpense(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('expense-category')
  getExpenseCategory(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getExpenseCategory(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('expense-item')
  getExpenseItem(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getExpenseItem(req.tenantId, from, to, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('sale-purchase-orders')
  getSalePurchaseOrders(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orderType') orderType?: string,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getSalePurchaseOrders(req.tenantId, from, to, orderType, status, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('sale-purchase-order-items')
  getSalePurchaseOrderItems(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orderType') orderType?: string,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.reports.getSalePurchaseOrderItems(req.tenantId, from, to, orderType, status, restrictCompanyIds(companyId, req.companyIds));
  }

  @Get('loan-statement')
  getLoanStatement(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getLoanStatement(req.tenantId, from, to);
  }
}
