import { expect, test } from '@playwright/test';
import { registerUser } from '../docker/synapse';
import { synapseStop, type SynapseInstance } from '../docker/synapse';
import {
  login,
  logout,
  assertRooms,
  createRoom,
  reloadAndOpenAiAssistant,
  registerRealmUsers,
  startTestingSynapse,
} from '../helpers';

test.describe('Room creation', () => {
  let synapse: SynapseInstance;
  test.beforeEach(async () => {
    synapse = await startTestingSynapse();
    await registerRealmUsers(synapse);
    await registerUser(synapse, 'user1', 'pass');
    await registerUser(synapse, 'user2', 'pass');
  });
  test.afterEach(async () => {
    await synapseStop(synapse.synapseId);
  });
  test('it can create a room with autogenerated name', async ({ page }) => {
    await login(page, 'user1', 'pass');
    await assertRooms(page, { joinedRooms: [] });
    await assertRooms(page, { invitedRooms: [] });

    await page.locator('[data-test-create-room-mode-btn]').click();

    let name = await page.locator('[data-test-room-name-field]').inputValue();
    await expect(page.locator('[data-test-room-name-field]')).toHaveValue(name);
    await expect(page.locator('[data-test-create-room-btn]')).toBeEnabled();
    await expect(
      page.locator('[data-test-create-room-cancel-btn]'),
    ).toBeEnabled();

    await page.locator('[data-test-create-room-btn]').click();
    await page.waitForFunction(() =>
      document.querySelector('[data-test-room-settled]'),
    );

    await assertRooms(page, { joinedRooms: [{ name }] });

    await reloadAndOpenAiAssistant(page);

    await assertRooms(page, { joinedRooms: [{ name }] });

    await logout(page);
    await login(page, 'user1', 'pass');
    await assertRooms(page, { joinedRooms: [{ name }] });

    // The room created is a private room, user2 was not invited to it
    await logout(page);
    await login(page, 'user2', 'pass');
    await assertRooms(page, {});
  });

  test('it can create a room with user-edited name', async ({ page }) => {
    await login(page, 'user1', 'pass');
    await assertRooms(page, { joinedRooms: [] });
    await assertRooms(page, { invitedRooms: [] });

    await page.locator('[data-test-create-room-mode-btn]').click();

    await page.locator('[data-test-room-name-field]').fill('');
    await expect(page.locator('[data-test-create-room-btn]')).toBeDisabled();

    let name = 'Room 1';

    await page.locator('[data-test-room-name-field]').fill(name);
    await expect(page.locator('[data-test-create-room-btn]')).toBeEnabled();

    await page.locator('[data-test-create-room-btn]').click();
    await page.waitForFunction(() =>
      document.querySelector('[data-test-room-settled]'),
    );
    await assertRooms(page, { joinedRooms: [{ name }] });

    await reloadAndOpenAiAssistant(page);
    await assertRooms(page, { joinedRooms: [{ name }] });

    await logout(page);
    await login(page, 'user1', 'pass');
    await assertRooms(page, { joinedRooms: [{ name }] });

    // The room created is a private room, user2 was not invited to it
    await logout(page);
    await login(page, 'user2', 'pass');
    await assertRooms(page, {});
  });

  test('it can cancel a room creation', async ({ page }) => {
    await login(page, 'user1', 'pass');
    await page.locator('[data-test-create-room-mode-btn]').click();

    let name1 = await page.locator('[data-test-room-name-field]').inputValue();
    await expect(page.locator('[data-test-room-name-field]')).toHaveValue(
      name1,
    );
    await expect(
      page.locator('[data-test-create-room-mode-btn]'),
    ).toBeDisabled();
    await page.locator('[data-test-room-name-field]').fill('Room 1');
    await page.locator('[data-test-create-room-cancel-btn]').click();

    await assertRooms(page, {});

    await expect(
      page.locator('[data-test-create-room-mode-btn]'),
    ).toBeEnabled();
    await page.locator('[data-test-create-room-mode-btn]').click();
    let name2 = await page.locator('[data-test-room-name-field]').inputValue();
    await expect(page.locator('[data-test-room-name-field]')).toHaveValue(
      name2,
    );
    expect(name1).not.toEqual(name2);
    await expect(page.locator('[data-test-create-room-btn]')).toBeEnabled();
  });

  test('rooms are sorted by join date', async ({ page }) => {
    await login(page, 'user1', 'pass');
    await createRoom(page, { name: 'Room Z' });
    await createRoom(page, { name: 'Room A' });

    await assertRooms(page, {
      joinedRooms: [{ name: 'Room Z' }, { name: 'Room A' }],
    });
  });

  test('it can invite a user to a new room', async ({ page }) => {
    await login(page, 'user1', 'pass');
    await createRoom(page, {
      name: 'Room 1',
      invites: ['user2'],
    });

    await assertRooms(page, {
      joinedRooms: [{ name: 'Room 1' }],
    });

    await logout(page);
    await login(page, 'user2', 'pass');
    await assertRooms(page, {
      invitedRooms: [{ name: 'Room 1', sender: 'user1' }],
    });
  });

  test('invites are sorted by invitation date', async ({ page }) => {
    await login(page, 'user1', 'pass');
    await createRoom(page, {
      name: 'Room Z',
      invites: ['user2'],
    });
    await createRoom(page, {
      name: 'Room A',
      invites: ['user2'],
    });

    await logout(page);
    await login(page, 'user2', 'pass');
    await assertRooms(page, {
      invitedRooms: [
        { name: 'Room Z', sender: 'user1' },
        { name: 'Room A', sender: 'user1' },
      ],
    });
  });

  test('it shows an error when a duplicate room is created', async ({
    page,
  }) => {
    await login(page, 'user1', 'pass');
    await createRoom(page, { name: 'Room 1' });

    await page.locator('[data-test-create-room-mode-btn]').click();
    await page.locator('[data-test-room-name-field]').fill('Room 1');
    await expect(
      page.locator(
        '[data-test-room-name-field][data-test-boxel-input-validation-state="initial"]',
      ),
      'room name field displays initial validation state',
    ).toHaveCount(1);
    await expect(
      page.locator(
        '[data-test-room-name-field] ~ [data-test-boxel-input-error-message]',
      ),
      'no error message is displayed',
    ).toHaveCount(0);
    await page.locator('[data-test-create-room-btn]').click();

    await expect(
      page.locator(
        '[data-test-room-name-field][data-test-boxel-input-validation-state="invalid"]',
      ),
      'room name field displays invalid validation state',
    ).toHaveCount(1);
    await expect(
      page.locator(
        '[data-test-room-name-field] ~ [data-test-boxel-input-error-message]',
      ),
    ).toContainText('Room already exists');

    await page.locator('[data-test-room-name-field]').fill('Room 2');
    await expect(
      page.locator(
        '[data-test-room-name-field][data-test-boxel-input-validation-state="initial"]',
      ),
      'room name field displays initial validation state',
    ).toHaveCount(1);
    await expect(
      page.locator(
        '[data-test-room-name-field] ~ [data-test-boxel-input-error-message]',
      ),
      'no error message is displayed',
    ).toHaveCount(0);
    await page.locator('[data-test-create-room-btn]').click();
    await page.waitForFunction(() =>
      document.querySelector('[data-test-room-settled]'),
    );
    await assertRooms(page, {
      joinedRooms: [{ name: 'Room 1' }, { name: 'Room 2' }],
    });
  });
});
