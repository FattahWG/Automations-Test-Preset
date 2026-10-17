import { test, expect, tagsFor } from '../support/case.fixture';
import { addToCartApi, apiLogin, CUSTOMER, fillCheckout, newCustomer, openAs, openWithToken } from '../support/helpers';

test('TC-ORD-001 A new order shows in My orders', { tag: tagsFor('TC-ORD-001') }, async ({ page, request, caseStep }) => {
  let orderId = '';
  await caseStep('UI', 'Place an order with the test card', async () => {
    const buyer = await newCustomer(request, 'ord1');
    const token = await apiLogin(request, buyer.email, buyer.password);
    await addToCartApi(request, token, 'p5');
    await openWithToken(page, token, '/checkout');
    await fillCheckout(page);
    await page.getByRole('button', { name: /^Pay / }).click();
    orderId = (await page.getByTestId('order-id').textContent()) || '';
    expect(orderId).toMatch(/^LS-\d+$/);
    return `Order ${orderId} is confirmed.`;
  });
  await caseStep('UI', 'Open My orders', async () => {
    await page.getByRole('link', { name: 'My orders' }).first().click();
    const row = page.getByRole('row').filter({ hasText: orderId });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Paid');
  });
});

test('TC-ORD-002 A customer cannot open another customer\'s order', { tag: tagsFor('TC-ORD-002') }, async ({ page, request, caseStep }) => {
  await caseStep('UI', 'Open order LS-10002 as customer@demo.com', async () => {
    await openAs(page, request, CUSTOMER, '/order/LS-10002');
    await expect(page.getByText('This order does not exist.')).toBeVisible();
    await expect(page.getByText('Rina Hartono')).toHaveCount(0);
    return 'The page says "This order does not exist." No data from Rina shows.';
  });
});
