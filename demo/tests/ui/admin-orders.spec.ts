import { test, expect, tagsFor } from '../support/case.fixture';
import { ADMIN, addToCartApi, apiLogin, fillCheckout, newCustomer, openWithToken, placeOrderApi } from '../support/helpers';

const orderRow = (page, id: string) => page.getByTestId('order-row').filter({ hasText: id });

async function buyerToken(request, label: string) {
  const buyer = await newCustomer(request, label);
  return { buyer, token: await apiLogin(request, buyer.email, buyer.password) };
}

test('TC-AOR-001 A new customer order shows in admin Orders', { tag: tagsFor('TC-AOR-001') }, async ({ page, request, caseStep }) => {
  const { buyer, token } = await buyerToken(request, 'aor1');
  let orderId = '';
  await caseStep('UI', 'Place an order as a new customer', async () => {
    await addToCartApi(request, token, 'p8');
    await openWithToken(page, token, '/checkout');
    await fillCheckout(page, { 'Full name': buyer.name });
    await page.getByRole('button', { name: /^Pay / }).click();
    orderId = (await page.getByTestId('order-id').textContent()) || '';
    expect(orderId).toMatch(/^LS-\d+$/);
  });
  await caseStep('UI', 'Sign in as admin and open Orders', async () => {
    await openWithToken(page, await apiLogin(request, ADMIN.email, ADMIN.password), '/admin/orders');
    await expect(orderRow(page, orderId)).toContainText('Paid');
    await expect(orderRow(page, orderId)).toContainText(buyer.name);
    return `Order ${orderId} shows as Paid for ${buyer.name}.`;
  });
});

test('TC-AOR-002 Admin moves an order from Paid to Processing', { tag: tagsFor('TC-AOR-002') }, async ({ page, request, caseStep }) => {
  const { token } = await buyerToken(request, 'aor2');
  await addToCartApi(request, token, 'p11');
  const orderId = await placeOrderApi(request, token);
  const status = page.getByLabel(`New status for ${orderId}`);
  await caseStep('UI', 'Open admin Orders for the new order', async () => {
    await openWithToken(page, await apiLogin(request, ADMIN.email, ADMIN.password), '/admin/orders');
    await expect(status.locator('option')).toHaveText(['Choose...', 'Processing', 'Cancelled']);
  });
  await caseStep('UI', 'Choose Processing', async () => {
    await status.selectOption('Processing');
    await expect(page.getByText(`Order ${orderId} is now Processing.`)).toBeVisible();
    await expect(orderRow(page, orderId).locator('.pill')).toHaveText('Processing');
  });
});

test('TC-AOR-003 Cancelling an order puts the stock back', { tag: tagsFor('TC-AOR-003') }, async ({ page, request, caseStep }) => {
  const adminToken = await apiLogin(request, ADMIN.email, ADMIN.password);
  const stockCell = page.getByTestId('product-row').filter({ hasText: 'Rattan Coaster Set' }).locator('td').nth(4);
  let before = 0;
  let orderId = '';
  await caseStep('UI', 'Note the stock, then order 2 as a new customer', async () => {
    await openWithToken(page, adminToken, '/admin/products?search=Rattan');
    before = Number(await stockCell.textContent());
    const { token } = await buyerToken(request, 'aor3');
    await addToCartApi(request, token, 'p8', 2);
    orderId = await placeOrderApi(request, token);
    await page.reload();
    await expect(stockCell).toHaveText(String(before - 2));
    return `Stock went from ${before} to ${before - 2} after order ${orderId}.`;
  });
  await caseStep('UI', 'Cancel the order in admin Orders', async () => {
    await page.goto(`/store/?t=${Date.now()}#/admin/orders`);
    await page.getByLabel(`New status for ${orderId}`).selectOption('Cancelled');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel order' }).click();
    await expect(orderRow(page, orderId).locator('.pill')).toHaveText('Cancelled');
    await page.goto(`/store/?t=${Date.now()}#/admin/products?search=Rattan`);
    await expect(stockCell).toHaveText(String(before));
    return `Order ${orderId} is Cancelled. Stock is back to ${before}.`;
  });
});
