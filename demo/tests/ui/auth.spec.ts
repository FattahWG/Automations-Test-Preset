import { test, expect, tagsFor } from '../support/case.fixture';
import { ADMIN, CUSTOMER, formAlert, signInWithForm, uniq } from '../support/helpers';

test('TC-AUTH-001 Sign in with the demo admin account', { tag: tagsFor('TC-AUTH-001') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Open the Sign in page', async () => {
    await page.goto('/store/#/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    return 'The Sign in form shows Email and Password.';
  });
  await caseStep('UI', 'Sign in with the demo admin account', async () => {
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    await expect(page.getByTestId('signed-in-user')).toHaveText(ADMIN.name);
    return 'The admin Dashboard opened. The header shows Demo Admin.';
  });
});

test('TC-AUTH-002 Wrong password shows an error', { tag: tagsFor('TC-AUTH-002') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Open the Sign in page', async () => {
    await page.goto('/store/#/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
  await caseStep('UI', 'Sign in with a wrong password', async () => {
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(formAlert(page)).toHaveText('Invalid email or password.');
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Sign in' })).toBeVisible();
    return 'The alert says "Invalid email or password." The user is still signed out.';
  });
});

test('TC-AUTH-003 Invalid email format is rejected', { tag: tagsFor('TC-AUTH-003') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Open the Sign in page', async () => {
    await page.goto('/store/#/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
  await caseStep('UI', 'Sign in with "not-an-email"', async () => {
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password', { exact: true }).fill('Anything123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('#err-email')).toHaveText('Enter a valid email address.');
    return 'The Email field shows "Enter a valid email address."';
  });
});

test('TC-AUTH-004 Disabled account cannot sign in', { tag: tagsFor('TC-AUTH-004') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Open the Sign in page', async () => {
    await page.goto('/store/#/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
  await caseStep('UI', 'Sign in as the disabled account budi@demo.com', async () => {
    await page.getByLabel('Email').fill('budi@demo.com');
    await page.getByLabel('Password', { exact: true }).fill('Budi12345');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(formAlert(page)).toHaveText('This account is disabled. Contact support.');
    return 'The alert says the account is disabled.';
  });
});

test('TC-AUTH-005 Register a new customer account', { tag: tagsFor('TC-AUTH-005') }, async ({ page, caseStep }) => {
  const email = `${uniq('register')}@example.test`;
  await caseStep('UI', 'Open Create account', async () => {
    await page.goto('/store/#/register');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
    await expect(page.locator('#register-form input')).toHaveCount(4);
  });
  await caseStep('UI', 'Submit a valid new account', async () => {
    await page.getByLabel('Full name').fill('QA Auto Register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Password123');
    await page.getByLabel('Confirm password').fill('Password123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Account created. Sign in to continue.')).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue(email);
    return `The account ${email} was created. The Sign in page has the email filled in.`;
  });
  await caseStep('UI', 'Sign in with the new account', async () => {
    await page.getByLabel('Password', { exact: true }).fill('Password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Shop', level: 1 })).toBeVisible();
    await expect(page.getByTestId('signed-in-user')).toHaveText('QA Auto Register');
  });
});

test('TC-AUTH-006 Register with an existing email is rejected', { tag: tagsFor('TC-AUTH-006') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Open Create account', async () => {
    await page.goto('/store/#/register');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });
  await caseStep('UI', 'Register with customer@demo.com', async () => {
    await page.getByLabel('Full name').fill('QA Auto Duplicate');
    await page.getByLabel('Email').fill(CUSTOMER.email);
    await page.getByLabel('Password', { exact: true }).fill('Password123');
    await page.getByLabel('Confirm password').fill('Password123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator('#err-email')).toHaveText('An account with this email already exists.');
  });
});

test('TC-AUTH-007 Weak password is rejected', { tag: tagsFor('TC-AUTH-007') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Open Create account', async () => {
    await page.goto('/store/#/register');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });
  await caseStep('UI', 'Register with the password "short"', async () => {
    await page.getByLabel('Full name').fill('QA Auto Weak');
    await page.getByLabel('Email').fill(`${uniq('weak')}@example.test`);
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Confirm password').fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator('#err-password')).toHaveText('Use at least 8 characters with letters and numbers.');
  });
});

test('TC-AUTH-008 Sign out ends the session', { tag: tagsFor('TC-AUTH-008') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Sign in as customer@demo.com', async () => {
    await signInWithForm(page, CUSTOMER);
    await expect(page.getByTestId('signed-in-user')).toHaveText(CUSTOMER.name);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });
  await caseStep('UI', 'Select Sign out', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Sign in' })).toBeVisible();
  });
  await caseStep('UI', 'Open My orders by its address', async () => {
    await page.goto('/store/#/orders');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    return 'My orders sent the signed-out user to Sign in.';
  });
});

test('TC-AUTH-009 A protected page asks for sign in, then returns to it', { tag: tagsFor('TC-AUTH-009') }, async ({ page, caseStep }) => {
  await caseStep('UI', 'Open the Cart page while signed out', async () => {
    await page.goto('/store/#/cart');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
  await caseStep('UI', 'Sign in as customer@demo.com', async () => {
    await page.getByLabel('Email').fill(CUSTOMER.email);
    await page.getByLabel('Password', { exact: true }).fill(CUSTOMER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Your cart', exact: true })).toBeVisible();
  });
});
