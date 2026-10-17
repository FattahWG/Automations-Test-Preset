import { test, expect, tagsFor } from '../support/case.fixture';
import { addToCartApi, apiLogin, CARD_DECLINED, cartCount, fillCheckout, formAlert, newCustomer, openWithToken } from '../support/helpers';

async function buyerAtCheckout(page, request, productId: string, label: string) {
  const buyer = await newCustomer(request, label);
  const token = await apiLogin(request, buyer.email, buyer.password);
  await addToCartApi(request, token, productId);
  await openWithToken(page, token, '/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  return token;
}

async function orderCount(request, token: string) {
  const res = await request.get('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
  return (await res.json()).orders.length;
}

test('TC-CHK-001 Checkout with the test card creates an order', { tag: tagsFor('TC-CHK-001') }, async ({ page, request, caseStep }) => {
  await caseStep('UI', 'Add Kopi Toraja Beans and open Checkout', async () => {
    await buyerAtCheckout(page, request, 'p10', 'chk1');
    await expect(page.getByRole('button', { name: /^Pay / })).toHaveText('Pay Rp 110.000');
  });
  await caseStep('UI', 'Fill a valid address and the test card, then select Pay', async () => {
    await fillCheckout(page);
    await page.getByRole('button', { name: /^Pay / }).click();
    await expect(page.getByTestId('order-confirmation')).toContainText(/Thank you! Your order LS-\d+ is confirmed\./);
    await expect(cartCount(page)).toHaveText('0');
    return `Order ${await page.getByTestId('order-id').textContent()} is confirmed. The cart count is 0.`;
  });
});

test('TC-CHK-002 Empty required fields are reported', { tag: tagsFor('TC-CHK-002') }, async ({ page, request, caseStep }) => {
  let token = '';
  await caseStep('UI', 'Open Checkout with one item and clear Full name', async () => {
    token = await buyerAtCheckout(page, request, 'p11', 'chk2');
    await page.getByLabel('Full name').fill('');
  });
  await caseStep('UI', 'Select Pay without filling the form', async () => {
    await page.getByRole('button', { name: /^Pay / }).click();
    await expect(page.locator('.error', { hasText: 'This field is required.' })).toHaveCount(9);
    await expect(page.locator('#err-name')).toHaveText('This field is required.');
    expect(await orderCount(request, token)).toBe(0);
    return '9 empty fields show "This field is required." No order was created.';
  });
});

test('TC-CHK-003 Declined card shows a payment error', { tag: tagsFor('TC-CHK-003') }, async ({ page, request, caseStep }) => {
  await caseStep('UI', 'Pay with the decline card', async () => {
    await buyerAtCheckout(page, request, 'p11', 'chk3');
    await fillCheckout(page, { 'Card number': CARD_DECLINED });
    await page.getByRole('button', { name: /^Pay / }).click();
    await expect(formAlert(page)).toHaveText('The card was declined. Use another card.');
  });
  await caseStep('UI', 'Open the cart', async () => {
    await page.getByRole('link', { name: /^Cart/ }).click();
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    return 'The item is still in the cart after the declined payment.';
  });
});

test('TC-CHK-004 Invalid card number is rejected', { tag: tagsFor('TC-CHK-004') }, async ({ page, request, caseStep }) => {
  await caseStep('UI', 'Pay with card 1234 5678 9012 3456', async () => {
    await buyerAtCheckout(page, request, 'p11', 'chk4');
    await fillCheckout(page, { 'Card number': '1234 5678 9012 3456' });
    await page.getByRole('button', { name: /^Pay / }).click();
    await expect(page.locator('#err-cardNumber')).toHaveText('Enter a valid 16-digit card number.');
  });
});

test('TC-CHK-005 Expired card is rejected', { tag: tagsFor('TC-CHK-005') }, async ({ page, request, caseStep }) => {
  await caseStep('UI', 'Pay with expiry 01/20', async () => {
    await buyerAtCheckout(page, request, 'p11', 'chk5');
    await fillCheckout(page, { 'Expiry (MM/YY)': '01/20' });
    await page.getByRole('button', { name: /^Pay / }).click();
    await expect(page.locator('#err-expiry')).toHaveText('This card has expired.');
  });
});

test('TC-CHK-006 Postal code must have exactly 5 digits', {
  tag: tagsFor('TC-CHK-006'),
  annotation: { type: 'issue', description: 'DEF-001: a 4-digit postal code is accepted. This case fails until the defect is fixed.' },
}, async ({ page, request, caseStep }) => {
  await caseStep('UI', 'Pay with postal code 4011', async () => {
    await buyerAtCheckout(page, request, 'p11', 'chk6');
    await fillCheckout(page, { 'Postal code': '4011' });
    await page.getByRole('button', { name: /^Pay / }).click();
    await expect(page.locator('#err-postalCode'), 'DEF-001: the app accepts 4 digits and creates the order').toHaveText('Enter a 5-digit postal code.');
  });
});
