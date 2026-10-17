import { test, expect, tagsFor } from '../support/case.fixture';
import { ADMIN, apiLogin, createProductApi, deleteProductApi, newSku, openWithToken, uniq } from '../support/helpers';

const row = (page, text: string) => page.getByTestId('product-row').filter({ hasText: text });
const cleanup: string[] = [];
let adminToken = '';

test.beforeEach(async ({ request }) => { adminToken = await apiLogin(request, ADMIN.email, ADMIN.password); });
test.afterEach(async ({ request }) => {
  // Tests remove the qa-auto data they made.
  while (cleanup.length) await deleteProductApi(request, adminToken, cleanup.pop()!);
});

test('TC-PRD-001 Admin creates a product', { tag: tagsFor('TC-PRD-001') }, async ({ page, request, caseStep }) => {
  const name = uniq('tote');
  const sku = newSku();
  await caseStep('UI', 'Open Products > Add product', async () => {
    await openWithToken(page, adminToken, '/admin/products');
    await page.getByRole('link', { name: 'Add product' }).click();
    await expect(page.getByRole('heading', { name: 'Add product' })).toBeVisible();
  });
  await caseStep('UI', 'Fill a product and select Create product', async () => {
    await page.getByLabel('Product name').fill(name);
    await page.getByLabel('SKU').fill(sku);
    await page.getByLabel('Category').selectOption('Accessories');
    await page.getByLabel('Price (IDR)').fill('123000');
    await page.getByLabel('Stock').fill('7');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByText('Product created.')).toBeVisible();
    await expect(row(page, sku)).toHaveCount(1);
    const id = await row(page, sku).getAttribute('data-id');
    if (id) cleanup.push(id);
    return `Product ${sku} is in the admin list.`;
  });
  await caseStep('UI', 'Search the shop for the new product', async () => {
    await page.goto(`/store/#/shop?search=${encodeURIComponent(name)}`);
    await expect(page.getByTestId('product-card').filter({ hasText: name })).toHaveCount(1);
  });
});

test('TC-PRD-002 Admin edits a product price', { tag: tagsFor('TC-PRD-002') }, async ({ page, request, caseStep }) => {
  const p = await createProductApi(request, adminToken);
  cleanup.push(p.id);
  await caseStep('UI', 'Select Edit on the product row', async () => {
    await openWithToken(page, adminToken, `/admin/products?search=${p.sku}`);
    await page.getByRole('link', { name: `Edit ${p.name}` }).click();
    await expect(page.getByRole('heading', { name: 'Edit product' })).toBeVisible();
    await expect(page.getByLabel('Price (IDR)')).toHaveValue(String(p.price));
  });
  await caseStep('UI', 'Change the price to 175000 and save', async () => {
    await page.getByLabel('Price (IDR)').fill('175000');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Product updated.')).toBeVisible();
    await expect(row(page, p.sku)).toContainText('Rp 175.000');
  });
});

test('TC-PRD-003 Admin deletes a product', { tag: tagsFor('TC-PRD-003') }, async ({ page, request, caseStep }) => {
  const p = await createProductApi(request, adminToken);
  await caseStep('UI', 'Select Delete on the product row', async () => {
    await openWithToken(page, adminToken, `/admin/products?search=${p.sku}`);
    await page.getByRole('button', { name: `Delete ${p.name}` }).click();
    await expect(page.getByRole('dialog')).toContainText(`Delete "${p.name}"?`);
  });
  await caseStep('UI', 'Confirm the delete', async () => {
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Product deleted.')).toBeVisible();
    await expect(row(page, p.sku)).toHaveCount(0);
  });
});

test('TC-PRD-004 Product form rejects invalid data', { tag: tagsFor('TC-PRD-004') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Submit an empty Add product form', async () => {
    await openWithToken(page, adminToken, '/admin/products/new');
    await page.getByRole('button', { name: 'Create product' }).click();
    for (const f of ['name', 'sku', 'price', 'stock']) await expect(page.locator(`#err-${f}`)).not.toBeEmpty();
    return 'Name, SKU, Price and Stock show their errors.';
  });
  await caseStep('UI', 'Use the existing SKU LS-APP-001', async () => {
    await page.getByLabel('Product name').fill(uniq('dup'));
    await page.getByLabel('SKU').fill('LS-APP-001');
    await page.getByLabel('Price (IDR)').fill('1000');
    await page.getByLabel('Stock').fill('1');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.locator('#err-sku')).toHaveText('This SKU is already used.');
  });
});

test('TC-PRD-005 A draft product is hidden from the shop', { tag: tagsFor('TC-PRD-005') }, async ({ page, request, caseStep }) => {
  const name = uniq('draft');
  const sku = newSku();
  await caseStep('UI', 'Create a product with status Draft', async () => {
    await openWithToken(page, adminToken, '/admin/products/new');
    await page.getByLabel('Product name').fill(name);
    await page.getByLabel('SKU').fill(sku);
    await page.getByLabel('Price (IDR)').fill('50000');
    await page.getByLabel('Stock').fill('3');
    await page.getByLabel('Status').selectOption('draft');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(row(page, sku)).toContainText('draft');
    const id = await row(page, sku).getAttribute('data-id');
    if (id) cleanup.push(id);
  });
  await caseStep('UI', 'Search the shop for it', async () => {
    await page.goto(`/store/#/shop?search=${encodeURIComponent(name)}`);
    await expect(page.getByRole('heading', { name: 'No products match your search' })).toBeVisible();
  });
});
