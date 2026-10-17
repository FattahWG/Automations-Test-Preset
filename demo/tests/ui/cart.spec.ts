import { test, expect, tagsFor } from '../support/case.fixture';
import { addToCartApi, apiLogin, cartCount, newCustomer, openWithToken } from '../support/helpers';

const line = (page, name: string) => page.getByTestId('cart-line').filter({ hasText: name });

test('TC-CART-001 Add a product to the cart', { tag: tagsFor('TC-CART-001') }, async ({ page, request, caseStep }) => {
  const buyer = await newCustomer(request, 'cart1');
  const token = await apiLogin(request, buyer.email, buyer.password);
  await caseStep('UI', 'Sign in as a new customer and open Ceramic Coffee Mug', async () => {
    await openWithToken(page, token, '/product/p7');
    await expect(page.getByRole('heading', { name: 'Ceramic Coffee Mug' })).toBeVisible();
    await expect(cartCount(page)).toHaveText('0');
  });
  await caseStep('UI', 'Select Add to cart', async () => {
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByText('Added to cart.')).toBeVisible();
    await expect(cartCount(page)).toHaveText('1');
    return 'The message says "Added to cart." The cart count is 1.';
  });
});

test('TC-CART-002 Changing the quantity updates the totals', { tag: tagsFor('TC-CART-002') }, async ({ page, request, caseStep }) => {
  const buyer = await newCustomer(request, 'cart2');
  const token = await apiLogin(request, buyer.email, buyer.password);
  await addToCartApi(request, token, 'p1');
  await caseStep('UI', 'Open the cart with one Lawak Classic Tee', async () => {
    await openWithToken(page, token, '/cart');
    await expect(page.getByTestId('subtotal')).toHaveText('Rp 149.000');
    await expect(page.getByTestId('shipping')).toHaveText('Rp 15.000');
  });
  await caseStep('UI', 'Increase the quantity to 2', async () => {
    await page.getByRole('button', { name: 'Increase Lawak Classic Tee' }).click();
    await expect(page.getByTestId('subtotal')).toHaveText('Rp 298.000');
    await expect(page.getByTestId('total')).toHaveText('Rp 313.000');
    return 'Subtotal Rp 298.000, shipping Rp 15.000, total Rp 313.000.';
  });
});

test('TC-CART-003 Shipping is free from Rp 300.000', { tag: tagsFor('TC-CART-003') }, async ({ page, request, caseStep }) => {
  const buyer = await newCustomer(request, 'cart3');
  const token = await apiLogin(request, buyer.email, buyer.password);
  await addToCartApi(request, token, 'p2');
  await caseStep('UI', 'Open the cart with Batik Pattern Hoodie', async () => {
    await openWithToken(page, token, '/cart');
    await expect(page.getByTestId('shipping')).toHaveText('Free');
    await expect(page.getByTestId('total')).toHaveText('Rp 329.000');
  });
});

test('TC-CART-004 Removing the last item shows an empty cart', { tag: tagsFor('TC-CART-004') }, async ({ page, request, caseStep }) => {
  const buyer = await newCustomer(request, 'cart4');
  const token = await apiLogin(request, buyer.email, buyer.password);
  await addToCartApi(request, token, 'p4');
  await caseStep('UI', 'Open the cart with Canvas Tote Bag', async () => {
    await openWithToken(page, token, '/cart');
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
  });
  await caseStep('UI', 'Select Remove', async () => {
    await line(page, 'Canvas Tote Bag').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
    await expect(cartCount(page)).toHaveText('0');
  });
});

test('TC-CART-005 Quantity limit of 10 is enforced', { tag: tagsFor('TC-CART-005') }, async ({ page, request, caseStep }) => {
  const buyer = await newCustomer(request, 'cart5');
  const token = await apiLogin(request, buyer.email, buyer.password);
  await addToCartApi(request, token, 'p9');
  const qty = page.getByRole('spinbutton', { name: 'Quantity for Jasmine Scented Candle' });
  await caseStep('UI', 'Open the cart with Jasmine Scented Candle', async () => {
    await openWithToken(page, token, '/cart');
    await expect(qty).toHaveValue('1');
  });
  await caseStep('UI', 'Type 11 in the quantity box', async () => {
    await qty.fill('11');
    await qty.press('Tab');
    await expect(page.locator('#cart-msg [role="alert"]')).toHaveText('Quantity must be 1 to 10.');
    await expect(qty).toHaveValue('1');
  });
});
