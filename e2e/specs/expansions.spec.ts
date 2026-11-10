import { expect, test } from '../fixtures';
import { addGameViaUi, fillGameForm, gameCards } from '../support/actions';

test('EXP-01 add an expansion from the base game, then find it in search @smoke', async ({
  page,
}) => {
  const baseId = await addGameViaUi(page, {
    title: 'Catan',
    type: 'Board game',
    minPlayers: 3,
    maxPlayers: 4,
  });
  const section = page.locator('[data-expansions]');
  await expect(section).toContainText('Expansions');

  await section.getByRole('link', { name: 'Add expansion' }).click();
  await expect(page.getByRole('heading', { name: 'Add an expansion for Catan' })).toBeVisible();
  // Pre-filled from the base game.
  await expect(page.getByRole('switch', { name: 'This is an expansion' })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Base game' })).toHaveValue('Catan');
  await expect(page.getByRole('switch', { name: 'Standalone' })).not.toBeChecked();

  await fillGameForm(page, {
    title: 'Seafarers',
    minPlayers: 3,
    maxPlayers: 6,
    description: 'A long description that should not be on the base page.',
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // Back on the base game with a short row: name and player count, no description.
  await expect(page).toHaveURL(new RegExp(`/games/${baseId}$`));
  const row = page.locator('[data-expansions] li').filter({ hasText: 'Seafarers' });
  await expect(row).toContainText('3–6 players');
  await expect(page.getByText('A long description')).toHaveCount(0);

  // Not in the browsable library, but search finds it.
  await page.goto('/games');
  await expect(gameCards(page).filter({ hasText: 'Seafarers' })).toHaveCount(0);
  await page.goto('/games?q=seafar');
  const card = gameCards(page).filter({ hasText: 'Seafarers' });
  await expect(card).toContainText('Expansion of Catan');

  // The expansion's own page links back and says it needs the base game.
  await card.click();
  await expect(page.getByRole('heading', { name: 'Seafarers' })).toBeVisible();
  await expect(page.locator('[data-expansion-note]')).toContainText('Needs the base game');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Catan');
});

test('EXP-02 mark an expansion as standalone', async ({ page }) => {
  await addGameViaUi(page, { title: 'Dominion', type: 'Card game' });
  await page.locator('[data-expansions]').getByRole('link', { name: 'Add expansion' }).click();
  await fillGameForm(page, { title: 'Intrigue' });
  await page.getByRole('switch', { name: 'Standalone' }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page
    .locator('[data-expansions]')
    .getByRole('link', { name: /Intrigue/ })
    .click();
  await expect(page.locator('[data-expansion-note]')).toContainText('Can be played on its own');
  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(page.getByRole('switch', { name: 'Standalone' })).toBeChecked();
});
