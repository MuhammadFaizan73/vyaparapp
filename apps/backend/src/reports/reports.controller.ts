import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { AuthedRequest } from '../auth/jwt.guard';
import { ReportsService } from './reports.service';

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
    @Query('companyTag') companyTag?: string,
  ) {
    return this.reports.getSaleReport(req.tenantId, from, to, status, partyId, companyTag);
  }

  @Get('purchase')
  getPurchase(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('partyId') partyId?: string,
  ) {
    return this.reports.getPurchaseReport(req.tenantId, from, to, status, partyId);
  }

  @Get('day-book')
  getDayBook(
    @Req() req: AuthedRequest,
    @Query('date') date?: string,
  ) {
    return this.reports.getDayBook(req.tenantId, date);
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
  ) {
    return this.reports.getAllTransactions(req.tenantId, from, to, txnType, paymentType, status, partyId);
  }

  @Get('profit-and-loss')
  getProfitAndLoss(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getProfitAndLoss(req.tenantId, from, to);
  }

  @Get('cash-flow')
  getCashFlow(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getCashFlow(req.tenantId, from, to);
  }

  @Get('party-statement')
  getPartyStatement(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('partyId') partyId?: string,
  ) {
    return this.reports.getPartyStatement(req.tenantId, from, to, partyId);
  }

  @Get('all-parties')
  getAllParties(@Req() req: AuthedRequest) {
    return this.reports.getAllParties(req.tenantId);
  }

  @Get('party-report-by-item')
  getPartyReportByItem(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getPartyReportByItem(req.tenantId, from, to);
  }

  @Get('sale-purchase-by-party')
  getSalePurchaseByParty(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getSalePurchaseByParty(req.tenantId, from, to);
  }

  @Get('sale-purchase-by-party-group')
  getSalePurchaseByPartyGroup(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getSalePurchaseByPartyGroup(req.tenantId, from, to);
  }

  @Get('stock-summary')
  getStockSummary(
    @Req() req: AuthedRequest,
    @Query('asOf') asOf?: string,
  ) {
    return this.reports.getStockSummary(req.tenantId, asOf);
  }

  @Get('low-stock')
  getLowStock(@Req() req: AuthedRequest) {
    return this.reports.getLowStock(req.tenantId);
  }

  @Get('stock-detail')
  getStockDetail(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getStockDetail(req.tenantId, from, to);
  }

  @Get('item-detail')
  getItemDetail(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('itemName') itemName?: string,
  ) {
    return this.reports.getItemDetail(req.tenantId, from, to, itemName);
  }

  @Get('item-wise-pnl')
  getItemWisePnl(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getItemWisePnl(req.tenantId, from, to);
  }

  @Get('item-category-pnl')
  getItemCategoryPnl(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getItemCategoryPnl(req.tenantId, from, to);
  }

  @Get('sale-purchase-by-item-category')
  getSalePurchaseByItemCategory(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getSalePurchaseByItemCategory(req.tenantId, from, to);
  }

  @Get('stock-summary-by-category')
  getStockSummaryByCategory(@Req() req: AuthedRequest) {
    return this.reports.getStockSummaryByCategory(req.tenantId);
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
  ) {
    return this.reports.getExpense(req.tenantId, from, to);
  }

  @Get('expense-category')
  getExpenseCategory(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getExpenseCategory(req.tenantId, from, to);
  }

  @Get('expense-item')
  getExpenseItem(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getExpenseItem(req.tenantId, from, to);
  }

  @Get('sale-purchase-orders')
  getSalePurchaseOrders(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orderType') orderType?: string,
    @Query('status') status?: string,
  ) {
    return this.reports.getSalePurchaseOrders(req.tenantId, from, to, orderType, status);
  }

  @Get('sale-purchase-order-items')
  getSalePurchaseOrderItems(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orderType') orderType?: string,
    @Query('status') status?: string,
  ) {
    return this.reports.getSalePurchaseOrderItems(req.tenantId, from, to, orderType, status);
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
