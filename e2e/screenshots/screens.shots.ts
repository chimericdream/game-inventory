// Visual reference run: screenshots of every page and notable state, grouped by workflow.
// Run with `pnpm shots`. Output goes to screenshots/<workflow>/<NN-name>.png plus INDEX.md.
import type { Page } from '@playwright/test';

import { expect, test, KID, MEMBER } from '../fixtures';
import { fillGameForm, gameCards } from '../support/actions';
import { choose, chooseByPlaceholder, formWith, PASSWORD } from '../support/mantine';
import { png } from '../support/images';
import { seedDemo } from './demo-data';
import { shot } from './shot';

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

test.use({ viewport: DESKTOP });

const csv = (text: string, name = 'games.csv') => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from(text),
});

async function mobile(page: Page, run: () => Promise<void>) {
  await page.setViewportSize(MOBILE);
  await run();
  await page.setViewportSize(DESKTOP);
}

async function dark(page: Page, run: () => Promise<void>) {
  await page.emulateMedia({ colorScheme: 'dark' });
  await run();
  await page.emulateMedia({ colorScheme: 'light' });
}

// ---------------------------------------------------------------------------------------------
// 01 auth
// ---------------------------------------------------------------------------------------------
test.describe('01-auth', () => {
  const F = '01-auth';

  test('login page states', async ({ anonPage: page }) => {
    await page.goto('/login');
    await shot(page, F, '01-login-empty', 'Sign-in form, nothing entered.', {
      viewer: 'anonymous',
    });

    await page.getByLabel('Email').fill('ada@example.com');
    await page.getByLabel(PASSWORD).fill('not-the-password');
    await shot(
      page,
      F,
      '02-login-filled',
      'Sign-in form with an email and a masked password typed in.',
      {
        viewer: 'anonymous',
      },
    );

    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
    await shot(
      page,
      F,
      '03-login-error',
      'Sign-in failed: red "Incorrect email or password." alert above the form.',
      {
        viewer: 'anonymous',
      },
    );

    await mobile(page, async () => {
      await shot(page, F, '04-login-error-mobile', 'The failed sign-in state at phone width.', {
        viewer: 'anonymous',
      });
    });
    await dark(page, async () => {
      await shot(page, F, '05-login-error-dark', 'The failed sign-in state in dark mode.', {
        viewer: 'anonymous',
        scheme: 'dark',
      });
    });
  });

  test('protected page redirects to login', async ({ anonPage: page }) => {
    await page.goto('/games');
    await expect(page).toHaveURL(/\/login/);
    await shot(
      page,
      F,
      '06-redirected-to-login',
      'What a signed-out visitor sees after opening /games.',
      {
        viewer: 'anonymous',
      },
    );
  });
});

// ---------------------------------------------------------------------------------------------
// 02 catalog browse
// ---------------------------------------------------------------------------------------------
test.describe('02-catalog-browse', () => {
  const F = '02-catalog-browse';

  test('empty library', async ({ page }) => {
    await page.goto('/games');
    await expect(page.getByText('No games match.')).toBeVisible();
    await shot(page, F, '01-empty-library', 'The catalog with no games at all.');
  });

  test('populated library, search and filters', async ({ page, db }) => {
    await seedDemo(db);
    await page.goto('/games');
    await expect(gameCards(page).first()).toBeVisible();
    await shot(
      page,
      F,
      '02-grid-default',
      '24 demo games as a card grid: covers, type badges, players, time.',
    );
    await shot(page, F, '03-grid-viewport-only', 'Above-the-fold view of the grid at 1440x900.', {
      fullPage: false,
    });

    await page.getByPlaceholder('Search titles').fill('ca');
    await expect(page).toHaveURL(/q=ca/);
    await shot(
      page,
      F,
      '04-search-results',
      'Title search "ca" with the filter bar showing the typed query.',
    );

    await page.getByPlaceholder('Search titles').fill('zzz-nothing');
    await expect(page.getByText('No games match.')).toBeVisible();
    await shot(page, F, '05-search-no-results', 'Search with no matches: the empty state.');

    await page.goto('/games');
    await chooseByPlaceholder(page, 'Any type', 'Video game');
    await expect(page).toHaveURL(/type=video/);
    await shot(page, F, '06-filter-type-video', 'Filtered to video games.');

    await page.goto('/games');
    await page.getByPlaceholder('Any type').click();
    await shot(
      page,
      F,
      '07-type-dropdown-open',
      'The type filter dropdown open, showing its options.',
      {
        fullPage: false,
      },
    );
    await page.keyboard.press('Escape');

    await page.goto('/games?type=board&tag=family&minutes=60');
    await expect(gameCards(page).first()).toBeVisible();
    await shot(
      page,
      F,
      '08-filters-combined',
      'Several filters at once (board games, tag family, max 60 min) with a Clear button.',
    );

    await page.goto('/games');
    await page.getByPlaceholder('Any tag').click();
    await shot(page, F, '09-tag-dropdown-open', 'The tag filter dropdown open.', {
      fullPage: false,
    });
    await page.keyboard.press('Escape');
    await page.getByPlaceholder('Any location').click();
    await shot(
      page,
      F,
      '10-location-dropdown-open',
      'The location filter dropdown open (nested locations show as paths).',
      {
        fullPage: false,
      },
    );
    await page.keyboard.press('Escape');
  });

  test('responsive and dark variants', async ({ page, db }) => {
    await seedDemo(db);
    await page.goto('/games');
    await expect(gameCards(page).first()).toBeVisible();
    await page.setViewportSize({ width: 820, height: 1100 });
    await shot(page, F, '11-grid-tablet', 'Catalog grid at tablet width (820px).');
    await mobile(page, async () => {
      await shot(
        page,
        F,
        '12-grid-mobile',
        'Catalog grid at phone width: collapsed header, single or double column.',
      );
      await page.locator('.mantine-Burger-root').click();
      await shot(page, F, '13-nav-open-mobile', 'Phone width with the navigation drawer opened .', {
        fullPage: false,
      });
    });
    await page.setViewportSize(DESKTOP);
    await dark(page, async () => {
      await shot(page, F, '14-grid-dark', 'Catalog grid in dark mode.', { scheme: 'dark' });
    });
  });
});

// ---------------------------------------------------------------------------------------------
// 03 game detail
// ---------------------------------------------------------------------------------------------
test.describe('03-game-detail', () => {
  const F = '03-game-detail';

  test('detail pages by type', async ({ page, db }) => {
    const { ids } = await seedDemo(db);
    const open = async (title: string) => {
      await page.goto(`/games/${ids[title]}`);
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    };

    await open('Catan');
    await shot(
      page,
      F,
      '01-board-game-two-copies',
      'Board game with cover, description, notes, tags, facts and two copies.',
    );
    await open('Wingspan');
    await shot(page, F, '02-board-game-one-copy', 'Board game with a single copy and an owner.');
    await open("Dungeons & Dragons: Player's Handbook");
    await shot(page, F, '03-rpg-book', 'RPG book: system and book kind facts.');
    await open('Mario Kart 8 Deluxe');
    await shot(page, F, '04-video-game', 'Video game with a platform on its copy.');
    await open('Ravensburger Castle 1000 pc');
    await shot(page, F, '05-puzzle', 'Puzzle type: no board-game facts.');
    await open('Betrayal at House on the Hill');
    await shot(
      page,
      F,
      '06-no-cover-image',
      'A game without a cover image (layout without a picture).',
    );
    await open(
      'A Very Long Game Title That Keeps Going to Test How Cards Wrap Across Several Lines',
    );
    await shot(page, F, '07-very-long-title', 'Stress test: a very long title and no cover.');

    await open('Pandemic');
    await shot(page, F, '08-game-on-loan', 'A game whose only copy is currently lent out.');

    await open('Catan');
    await mobile(page, async () => {
      await shot(page, F, '09-board-game-mobile', 'Catan detail at phone width.');
    });
    await dark(page, async () => {
      await shot(page, F, '10-board-game-dark', 'Catan detail in dark mode.', { scheme: 'dark' });
    });
  });

  test('not found', async ({ page }) => {
    await page.goto('/games/not-a-real-id');
    await shot(page, F, '11-not-found', 'The 404 page for an unknown game id.');
  });
});

// ---------------------------------------------------------------------------------------------
// 04 add and edit game
// ---------------------------------------------------------------------------------------------
test.describe('04-add-edit-game', () => {
  const F = '04-add-edit-game';

  test('add game form', async ({ page, db }) => {
    await seedDemo(db);
    await page.goto('/games/new');
    await shot(
      page,
      F,
      '01-add-empty-board-game',
      'Add game form, default board-game fields, nothing entered.',
    );

    await page.getByPlaceholder('Search a title to fill in the details').fill('catan');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(1500);
    await shot(
      page,
      F,
      '02-lookup-search-results',
      'Title lookup against the (mocked) BoardGameGeek search showing suggestions.',
    );
    await page.getByPlaceholder('Search a title to fill in the details').fill('__500');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(1500);
    await shot(
      page,
      F,
      '03-lookup-upstream-error',
      'Title lookup when the upstream service errors.',
    );
    await page.getByPlaceholder('Search a title to fill in the details').fill('');

    await choose(page, page, 'Type', 'Video game');
    await shot(
      page,
      F,
      '04-add-video-game-fields',
      'Type switched to video game: the board-game fields are gone.',
    );
    await choose(page, page, 'Type', 'RPG');
    await shot(page, F, '05-add-rpg-fields', 'Type switched to RPG: system and book kind fields.');
    await choose(page, page, 'Type', 'Board game');

    await fillGameForm(page, {
      title: 'Everdell',
      minPlayers: 1,
      maxPlayers: 4,
      playTime: 80,
      complexity: 3,
      minAge: 13,
      tags: 'strategy, engine-building, woodland',
      description: 'Build a city of woodland critters across four seasons.',
      notes: 'Box has a small tear on one corner.',
      visibility: 'Hide images from restricted profiles',
      shareable: true,
      cover: png(),
    });
    await shot(
      page,
      F,
      '06-add-fully-filled',
      'Every field filled in, including a chosen visibility, guest-link switch and a cover file.',
    );

    await page.getByLabel(/^Title/).fill('   ');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.mantine-Alert-root')).toBeVisible();
    await shot(
      page,
      F,
      '07-add-validation-error',
      'Saving with a blank title: red error alert with the rest of the entered fields kept.',
    );

    await mobile(page, async () => {
      await shot(page, F, '08-add-form-mobile', 'The filled add form at phone width.');
    });
    await dark(page, async () => {
      await shot(page, F, '09-add-form-dark', 'The add form in dark mode.', { scheme: 'dark' });
    });
  });

  test('upload errors and edit form', async ({ page, db }) => {
    const { ids } = await seedDemo(db);
    await page.goto('/games/new');
    await page.getByLabel(/^Title/).fill('Bad Upload');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.mantine-Alert-root')).toBeVisible();
    await shot(
      page,
      F,
      '10-add-cover-wrong-type-error',
      'Uploading a text file as a cover: "JPEG, PNG, or WebP" error.',
    );

    await page.goto(`/games/${ids.Catan}/edit`);
    await expect(page.getByLabel(/^Title/)).toHaveValue('Catan');
    await shot(
      page,
      F,
      '11-edit-existing-game',
      'Edit form for Catan, pre-filled, with the current cover shown.',
    );

    await page.goto(`/games/${ids['Mario Kart 8 Deluxe']}/edit`);
    await shot(page, F, '12-edit-video-game', 'Edit form for a video game.');
    await page.goto(`/games/${ids['Gloomhaven: Jaws of the Lion']}/edit`);
    await shot(
      page,
      F,
      '13-edit-hidden-from-restricted',
      'Edit form for a game hidden from restricted profiles (non-default visibility).',
    );
  });
});

// ---------------------------------------------------------------------------------------------
// 05 copies
// ---------------------------------------------------------------------------------------------
test.describe('05-copies', () => {
  const F = '05-copies';

  test('copies panel', async ({ page, db }) => {
    const { ids } = await seedDemo(db);
    const bare = await db.seedGame({ title: 'Brand New Arrival', cover: true });
    await page.goto(`/games/${bare}`);
    await expect(page.getByText('No copies recorded yet.')).toBeVisible();
    await shot(
      page,
      F,
      '01-no-copies-yet',
      'A game with no copies: empty state plus the empty Add copy form.',
    );

    const form = formWith(page, 'Add copy');
    await form.getByLabel('Platform').fill('Tabletop');
    await form.getByLabel('Price ($)').fill('29.99');
    await choose(page, form, 'Condition', 'Good');
    await form.getByRole('combobox', { name: 'Location' }).click();
    await shot(
      page,
      F,
      '02-add-copy-location-open',
      'Add copy form with the location dropdown open.',
      { fullPage: false },
    );
    await page.getByRole('option').first().click();
    await shot(page, F, '03-add-copy-filled', 'Add copy form completely filled in before saving.');
    await form.getByRole('button', { name: /^Add/ }).click();
    await expect(page.getByText('No copies recorded yet.')).toHaveCount(0);
    await shot(page, F, '04-after-adding-copy', 'The panel after the first copy was added.');

    await page.goto(`/games/${ids.Catan}`);
    await shot(
      page,
      F,
      '05-multiple-copies',
      'Catan with two copies of different condition, location and price.',
      {
        of: page.locator('main'),
      },
    );
  });
});

// ---------------------------------------------------------------------------------------------
// 06 loans
// ---------------------------------------------------------------------------------------------
test.describe('06-loans', () => {
  const F = '06-loans';

  test('loans page', async ({ page, db }) => {
    await page.goto('/loans');
    await expect(page.getByText('Nothing is out on loan.')).toBeVisible();
    await shot(page, F, '01-empty', 'No games on loan, with the empty Lend form.');

    await seedDemo(db);
    await page.goto('/loans');
    await shot(
      page,
      F,
      '02-populated',
      'Three loans: one overdue, one with a future due date, one open-ended.',
    );

    const form = formWith(page, 'Lend');
    await form.getByRole('combobox', { name: /^Game/ }).click();
    await shot(
      page,
      F,
      '03-game-picker-open',
      'Lend form with the game picker open (copies already out are not offered).',
      {
        fullPage: false,
      },
    );
    await page.getByRole('option').first().click();
    await form.getByLabel('Borrower').fill('Grandma Pat');
    await form.getByLabel('Due (optional)').fill('2026-12-24');
    await shot(page, F, '04-lend-form-filled', 'Lend form filled in before submitting.');

    await form.getByRole('button', { name: 'Lend' }).click();
    await expect(page.getByText('With Grandma Pat')).toBeVisible();
    await shot(page, F, '05-after-lending', 'The list after a new loan was added.');

    await form.getByLabel('Borrower').fill('   ');
    await form.getByRole('combobox', { name: /^Game/ }).click();
    await page.getByRole('option').first().click();
    await form.getByRole('button', { name: 'Lend' }).click();
    await expect(page.locator('.mantine-Alert-root')).toBeVisible();
    await shot(page, F, '06-blank-borrower-error', 'Submitting without a borrower: error alert.');

    await mobile(page, async () => {
      await shot(page, F, '07-populated-mobile', 'Loans page at phone width.');
    });
    await dark(page, async () => {
      await shot(page, F, '08-populated-dark', 'Loans page in dark mode.', { scheme: 'dark' });
    });
  });
});

// ---------------------------------------------------------------------------------------------
// 07 wishlist
// ---------------------------------------------------------------------------------------------
test.describe('07-wishlist', () => {
  const F = '07-wishlist';

  test('wishlist page', async ({ page, db }) => {
    await page.goto('/wishlist');
    await expect(page.getByText('The wishlist is empty.')).toBeVisible();
    await shot(page, F, '01-empty', 'Empty wishlist with the Add form.');

    await seedDemo(db);
    await page.goto('/wishlist');
    await shot(
      page,
      F,
      '02-populated',
      'Three wishlist items: with link, price and notes; price only; and bare.',
    );

    const form = formWith(page, /^Add$/);
    await form.getByLabel('Title').fill('Spirit Island');
    await choose(page, form, 'Type', 'Board game');
    await form.getByLabel('Link').fill('https://example.com/spirit-island');
    await form.getByLabel('Price ($)').fill('79.99');
    await form.getByLabel('Notes').fill('Birthday idea');
    await shot(page, F, '03-add-form-filled', 'Add form completely filled in.');

    await form.getByLabel('Title').fill('Bad link');
    await form.getByLabel('Link').fill('javascript:alert(1)');
    await form.getByRole('button', { name: /^Add$/ }).click();
    await expect(page.locator('.mantine-Alert-root')).toBeVisible();
    await shot(page, F, '04-invalid-link-error', 'Submitting a non-http(s) link: error alert.');

    await mobile(page, async () => {
      await shot(page, F, '05-populated-mobile', 'Wishlist at phone width.');
    });
  });
});

// ---------------------------------------------------------------------------------------------
// 08 plays
// ---------------------------------------------------------------------------------------------
test.describe('08-plays', () => {
  const F = '08-plays';

  test('play log', async ({ page, db }) => {
    await page.goto('/plays');
    await expect(page.getByText('No plays logged yet.')).toBeVisible();
    await shot(page, F, '01-empty', 'Play log with nothing logged yet.');

    await seedDemo(db);
    await page.goto('/plays');
    await shot(
      page,
      F,
      '02-populated',
      'Recent plays, most played ranking and the not-played-in-a-year list.',
    );

    const form = formWith(page, 'Log play');
    await choose(page, form, 'Game', 'Azul');
    await form.getByLabel('Date').fill('2026-03-14');
    await form.getByLabel('Minutes').fill('45');
    await form.getByLabel('Players').fill('Ann, Bob, Cy');
    await form.getByLabel('Winner').fill('Cy');
    await form.getByLabel('Notes').fill('Close finish');
    await shot(page, F, '03-log-form-filled', 'Log-a-play form completely filled in.');

    await form.getByRole('button', { name: 'Log play' }).click();
    await expect(page.locator('.mantine-Paper-root', { hasText: 'Azul' })).toBeVisible();
    await shot(page, F, '04-after-logging', 'The list after logging a play.');

    await mobile(page, async () => {
      await shot(page, F, '05-populated-mobile', 'Play log at phone width.');
    });
    await dark(page, async () => {
      await shot(page, F, '06-populated-dark', 'Play log in dark mode.', { scheme: 'dark' });
    });
  });
});

// ---------------------------------------------------------------------------------------------
// 09 import
// ---------------------------------------------------------------------------------------------
test.describe('09-import', () => {
  const F = '09-import';

  test('csv import', async ({ page }) => {
    await page.goto('/import');
    await shot(page, F, '01-initial', 'Import page before choosing a file.');

    await page
      .locator('input[type="file"]')
      .setInputFiles(
        csv(
          'title,type,min_players,max_players,minutes,tags,location\nCatan,board,3,4,90,strategy,Hall closet\n',
        ),
      );
    await shot(page, F, '02-file-chosen', 'A CSV file chosen, not yet imported.');

    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('.mantine-Alert-root')).toContainText('Imported 1 game');
    await shot(page, F, '03-success', 'Successful import summary.');

    await page
      .locator('input[type="file"]')
      .setInputFiles(
        csv('title,type\nCATAN,board\nGood One,board\n,board\nBad Type,spaceship\nGood Two,card\n'),
      );
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByText(/Line 4/)).toBeVisible();
    await shot(
      page,
      F,
      '04-partial-success-with-row-errors',
      'Mixed import: some rows imported, one skipped as a duplicate, bad rows listed by line number.',
    );

    await page.locator('input[type="file"]').setInputFiles(csv('foo,bar\n1,2\n', 'wrong.csv'));
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('.mantine-Alert-root').first()).toContainText(/title/i);
    await shot(
      page,
      F,
      '05-error-missing-title-column',
      'A file without a title column is refused with a red alert.',
    );

    await mobile(page, async () => {
      await shot(page, F, '06-error-mobile', 'The import error state at phone width.');
    });
  });
});

// ---------------------------------------------------------------------------------------------
// 10 settings
// ---------------------------------------------------------------------------------------------
test.describe('10-settings', () => {
  const F = '10-settings';

  test('admin settings', async ({ page, db }) => {
    await seedDemo(db);
    await page.goto('/settings');
    await shot(
      page,
      F,
      '01-admin-overview',
      'Settings as an admin: people, locations and guest links sections.',
    );

    const people = formWith(page, 'Add person');
    await people.getByLabel('Name').fill('Grandpa Gus');
    await people.getByLabel('Email').fill('gus@example.com');
    await people.getByLabel(PASSWORD).fill('grandpa-pass-1');
    await choose(page, people, 'Profile', 'Restricted (kids)');
    await shot(
      page,
      F,
      '02-add-person-filled',
      'Add person form filled in with the profile dropdown set.',
    );

    await people.getByLabel(PASSWORD).fill('short');
    await people.getByRole('button', { name: 'Add person' }).click();
    await expect(page.locator('.mantine-Alert-root')).toContainText('Use at least 8 characters');
    await shot(
      page,
      F,
      '03-add-person-password-error',
      'Adding a person with a short password: error alert.',
    );

    await people.getByLabel('Name').fill('Copycat');
    await people.getByLabel('Email').fill(MEMBER.email);
    await people.getByLabel(PASSWORD).fill('long-enough-pass');
    await people.getByRole('button', { name: 'Add person' }).click();
    await expect(page.locator('.mantine-Alert-root')).toContainText(/already used/i);
    await shot(
      page,
      F,
      '04-add-person-duplicate-email-error',
      'Adding a person with an email already in use: error alert.',
    );

    const loc = formWith(page, 'Add location');
    await loc.getByLabel('New location').fill('Garage');
    await choose(page, loc, 'Inside (optional)', 'Attic');
    await shot(
      page,
      F,
      '05-add-location-filled',
      'Add location form filled in with a parent location.',
    );

    await mobile(page, async () => {
      await shot(page, F, '06-admin-mobile', 'Settings as an admin at phone width.');
    });
    await dark(page, async () => {
      await shot(page, F, '07-admin-dark', 'Settings as an admin in dark mode.', {
        scheme: 'dark',
      });
    });
  });

  test('member and restricted settings', async ({ memberPage, kidPage, db }) => {
    await seedDemo(db);
    await memberPage.goto('/settings');
    await shot(
      memberPage,
      F,
      '08-member-view',
      'Settings as a member: no add-person form or guest links.',
      {
        viewer: 'member',
      },
    );
    await kidPage.goto('/settings');
    await shot(kidPage, F, '09-restricted-view', 'Settings as a restricted profile: read-only.', {
      viewer: 'restricted',
    });
  });
});

// ---------------------------------------------------------------------------------------------
// 11 guest links
// ---------------------------------------------------------------------------------------------
test.describe('11-guest-links', () => {
  const F = '11-guest-links';

  test('creating and managing links', async ({ page, db }) => {
    await seedDemo(db);
    await page.goto('/settings');
    const form = formWith(page, 'Create link');
    await form.scrollIntoViewIfNeeded();
    await shot(
      page,
      F,
      '01-create-link-empty',
      'Guest links section with the empty Create link form.',
      {
        of: page.locator('form').filter({ has: page.getByRole('button', { name: 'Create link' }) }),
      },
    );

    await form.getByLabel('Name').fill('Game store trip');
    await form.getByLabel(/^Expires after/).fill('14');
    await form.getByRole('checkbox', { name: 'Video game' }).check();
    await form.getByRole('switch', { name: 'Show notes' }).check();
    await shot(
      page,
      F,
      '02-create-link-filled',
      'Create link form with a name, expiry, a hidden type and Show notes on.',
    );

    await form.getByRole('button', { name: 'Create link' }).click();
    await expect(page.getByText(/Link created/)).toBeVisible();
    await shot(
      page,
      F,
      '03-link-created-url-shown-once',
      'Right after creating: the link URL and Copy button, shown only once.',
    );

    await db.seedShareLink({ label: 'Expired link', expiresAt: new Date(Date.now() - 86_400_000) });
    await db.seedShareLink({ label: 'Revoked link', revoked: true });
    await page.reload();
    await shot(
      page,
      F,
      '04-links-list-active-expired-revoked',
      'The list of links showing Active, Expired and Revoked badges.',
    );
  });

  test('guest views', async ({ anonPage: page, db }) => {
    const { ids } = await seedDemo(db);
    const token = await db.seedShareLink({ label: 'Game store trip' });
    await page.goto(`/g/${token}`);
    await shot(
      page,
      F,
      '05-guest-catalog',
      'What a guest sees: only games allowed on guest links, read-only, no navigation into the household.',
      {
        viewer: 'guest',
      },
    );

    await page.getByPlaceholder('Search titles').fill('ca');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    await shot(page, F, '06-guest-catalog-search', 'Guest catalog with a search typed .', {
      viewer: 'guest',
    });

    await page.goto(`/g/${token}/${ids.Catan}`);
    await shot(
      page,
      F,
      '07-guest-game-detail',
      'Guest view of a single game: private notes, price and locations are hidden.',
      {
        viewer: 'guest',
      },
    );

    const rich = await db.seedShareLink({ label: 'Family', showNotes: true, showLocations: true });
    await page.goto(`/g/${rich}/${ids.Catan}`);
    await shot(
      page,
      F,
      '08-guest-game-detail-notes-and-locations',
      'Guest detail on a link that also shows notes and locations.',
      {
        viewer: 'guest',
      },
    );

    const filtered = await db.seedShareLink({
      label: 'No video',
      hideTypes: ['video', 'rpg'],
      hideTags: ['party'],
    });
    await page.goto(`/g/${filtered}`);
    await shot(
      page,
      F,
      '09-guest-catalog-filtered-link',
      'A link that hides video games, RPGs and the "party" tag.',
      {
        viewer: 'guest',
      },
    );

    await mobile(page, async () => {
      await page.goto(`/g/${token}`);
      await shot(page, F, '10-guest-catalog-mobile', 'Guest catalog at phone width.', {
        viewer: 'guest',
      });
    });
    await dark(page, async () => {
      await shot(page, F, '11-guest-catalog-dark', 'Guest catalog in dark mode.', {
        viewer: 'guest',
        scheme: 'dark',
      });
    });
  });

  test('guest error states', async ({ anonPage: page, db }) => {
    const expired = await db.seedShareLink({ expiresAt: new Date(Date.now() - 1000) });
    await page.goto(`/g/${expired}`);
    await shot(page, F, '12-expired-link', 'Opening an expired guest link.', { viewer: 'guest' });
    const revoked = await db.seedShareLink({ revoked: true });
    await page.goto(`/g/${revoked}`);
    await shot(page, F, '13-revoked-link', 'Opening a revoked guest link.', { viewer: 'guest' });
    await page.goto('/g/this-token-does-not-exist');
    await shot(page, F, '14-unknown-link', 'Opening a made-up guest link.', { viewer: 'guest' });
  });
});

// ---------------------------------------------------------------------------------------------
// 12 restricted profile
// ---------------------------------------------------------------------------------------------
test.describe('12-restricted-profile', () => {
  const F = '12-restricted-profile';

  test('what a restricted profile sees', async ({ kidPage: page, db }) => {
    const { ids } = await seedDemo(db);
    await page.goto('/games');
    await expect(gameCards(page).first()).toBeVisible();
    await shot(
      page,
      F,
      '01-catalog',
      'Catalog as a restricted profile: hidden games are absent; trimmed navigation (Games, Settings).',
      {
        viewer: 'restricted',
      },
    );
    await page.goto(`/games/${ids['Call of Cthulhu Starter Set']}`);
    await shot(
      page,
      F,
      '02-detail-with-images-hidden',
      'A "hide images" game: details but no cover.',
      {
        viewer: 'restricted',
      },
    );
    await page.goto(`/games/${ids.Catan}`);
    await shot(
      page,
      F,
      '03-detail-read-only',
      'Detail page for a restricted profile: no Edit/Delete, no notes, no add-copy form.',
      {
        viewer: 'restricted',
      },
    );
    await page.goto(`/games/${ids['Gloomhaven: Jaws of the Lion']}`);
    await shot(
      page,
      F,
      '04-hidden-game-not-found',
      'Opening a game hidden from restricted profiles: a 404.',
      {
        viewer: 'restricted',
      },
    );
    await page.goto('/games/new');
    await expect(page).toHaveURL(/\/games$/);
    await mobile(page, async () => {
      await shot(page, F, '05-catalog-mobile', 'Restricted catalog at phone width.', {
        viewer: 'restricted',
      });
    });
    expect(KID.role).toBe('restricted');
  });

  test('member navigation', async ({ memberPage: page, db }) => {
    await seedDemo(db);
    await page.goto('/games');
    await expect(gameCards(page).first()).toBeVisible();
    await shot(
      page,
      F,
      '06-member-catalog',
      'Catalog as a member (full navigation, no admin-only settings sections).',
      {
        viewer: 'member',
      },
    );
  });
});
