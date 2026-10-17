import { test, expect, tagsFor } from '../support/case.fixture';
import { ADMIN, CUSTOMER, formAlert, newCustomer, openAs, signInWithForm } from '../support/helpers';

const userRow = (page, email: string) => page.getByTestId('user-row').filter({ hasText: email });

test('TC-USR-001 A customer cannot open admin pages', { tag: tagsFor('TC-USR-001') }, async ({ page, request, caseStep }) => {
  await caseStep('UI', 'Sign in as customer@demo.com', async () => {
    await openAs(page, request, CUSTOMER, '/shop');
    await expect(page.getByTestId('signed-in-user')).toHaveText(CUSTOMER.name);
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });
  await caseStep('UI', 'Open the admin Users page by its address', async () => {
    await page.goto('/store/#/admin/users');
    await expect(page.getByTestId('forbidden')).toContainText('You do not have access to this page');
    await expect(page.getByTestId('user-row')).toHaveCount(0);
  });
});

test('TC-USR-002 A disabled customer cannot sign in', { tag: tagsFor('TC-USR-002') }, async ({ page, request, caseStep }) => {
  const victim = await newCustomer(request, 'usr2');
  await caseStep('UI', 'Open Users as admin', async () => {
    await openAs(page, request, ADMIN, '/admin/users');
    await expect(userRow(page, victim.email).locator('.pill')).toHaveText('active');
  });
  await caseStep('UI', 'Select Disable and confirm', async () => {
    await userRow(page, victim.email).getByRole('button', { name: 'Disable' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Disable' }).click();
    await expect(userRow(page, victim.email).locator('.pill')).toHaveText('disabled');
  });
  await caseStep('UI', 'Sign in as the disabled customer', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signInWithForm(page, victim);
    await expect(formAlert(page)).toHaveText('This account is disabled. Contact support.');
  });
});

test('TC-USR-003 Admin cannot change their own role or status', { tag: tagsFor('TC-USR-003') }, async ({ page, request, caseStep }) => {
  await caseStep('UI', 'Open Users as admin', async () => {
    await openAs(page, request, ADMIN, '/admin/users');
    const me = userRow(page, ADMIN.email);
    await expect(me).toContainText('(you)');
    await expect(me.locator('select')).toHaveCount(0);
    await expect(me.getByRole('button', { name: 'Disable' })).toHaveCount(0);
  });
});

test('TC-DSH-001 Admin dashboard shows the KPIs', { tag: tagsFor('TC-DSH-001') }, async ({ page, request, caseStep }) => {
  await caseStep('UI', 'Open Dashboard as admin', async () => {
    await openAs(page, request, ADMIN, '/admin');
    await expect(page.getByTestId('kpi-revenue')).toHaveText(/^Rp [\d.]+$/);
    for (const k of ['kpi-orders', 'kpi-customers', 'kpi-low-stock']) await expect(page.getByTestId(k)).toHaveText(/^\d+$/);
    await expect(page.locator('table').first().locator('tbody tr')).toHaveCount(5);
    return `Revenue ${await page.getByTestId('kpi-revenue').textContent()}, orders ${await page.getByTestId('kpi-orders').textContent()}.`;
  });
});
