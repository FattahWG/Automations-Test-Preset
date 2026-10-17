import { test, expect, tagsFor } from '../support/case.fixture';

const cards = (page) => page.getByTestId('product-card');

test('TC-CAT-001 Shop lists all active products and hides drafts', { tag: tagsFor('TC-CAT-001') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Open the Shop page', async () => {
    await page.goto('/store/#/shop');
    await expect(page.getByTestId('result-count')).toHaveText('11 products');
    await expect(cards(page)).toHaveCount(11);
  });
  await caseStep('UI', 'Look for the draft product Anniversary Jacket', async () => {
    await expect(cards(page).filter({ hasText: 'Anniversary Jacket' })).toHaveCount(0);
    return 'Anniversary Jacket (draft) is not in the list.';
  });
});

test('TC-CAT-002 Search finds a product by name', { tag: tagsFor('TC-CAT-002') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Search the shop for "mug"', async () => {
    await page.goto('/store/#/shop');
    await page.getByRole('searchbox', { name: 'Search products' }).fill('mug');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByTestId('result-count')).toHaveText('1 product');
    await expect(cards(page)).toContainText(['Ceramic Coffee Mug']);
  });
});

test('TC-CAT-003 Category filter shows only that category', { tag: tagsFor('TC-CAT-003') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Choose the category Home', async () => {
    await page.goto('/store/#/shop');
    await page.getByLabel('Category').selectOption('Home');
    await expect(page.getByTestId('result-count')).toHaveText('3 products');
    for (const card of await cards(page).all()) await expect(card).toContainText('Home');
  });
});

test('TC-CAT-004 Sort by price from low to high', { tag: tagsFor('TC-CAT-004') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Choose "Price: low to high"', async () => {
    await page.goto('/store/#/shop');
    await page.getByLabel('Sort').selectOption({ label: 'Price: low to high' });
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(cards(page).first()).toContainText('Spicy Cassava Chips');
    await expect(cards(page).first()).toContainText('Rp 25.000');
  });
});

test('TC-CAT-005 Search with no result shows an empty state', { tag: tagsFor('TC-CAT-005') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Search the shop for "zzzz"', async () => {
    await page.goto('/store/#/shop?search=zzzz');
    await expect(page.getByRole('heading', { name: 'No products match your search' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Clear filters' })).toBeVisible();
  });
});

test('TC-CAT-006 Product detail shows the price and stock', { tag: tagsFor('TC-CAT-006') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Open Lawak Classic Tee from the shop', async () => {
    await page.goto('/store/#/shop');
    await cards(page).filter({ hasText: 'Lawak Classic Tee' }).click();
    await expect(page.getByRole('heading', { name: 'Lawak Classic Tee', level: 1 })).toBeVisible();
    await expect(page.getByTestId('product-price')).toHaveText('Rp 149.000');
    await expect(page.getByTestId('stock-status')).toHaveText('In stock');
  });
});

test('TC-CAT-007 Out-of-stock product cannot be added to the cart', { tag: tagsFor('TC-CAT-007') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Open Bucket Hat', async () => {
    await page.goto('/store/#/shop');
    await cards(page).filter({ hasText: 'Bucket Hat' }).click();
    await expect(page.getByTestId('stock-status')).toHaveText('Out of stock');
    await expect(page.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(0);
  });
});
