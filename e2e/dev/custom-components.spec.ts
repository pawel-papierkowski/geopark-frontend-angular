import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Tests for dev custom components page.
 */
test.describe('Custom components page', () => {
  test('should navigate to the custom components page', async ({ page }) => {
    // Arrange: Start on custom components page.
    await page.goto('/dev/components');

    // Assert: Custom components page content is visible.
    await expect(page.locator('body')).toContainText('Custom components');
  });

  test('is correct axe-wise', async ({ page }) => {
    // Arrange: Start on custom components page.
    await page.goto('/dev/components');
    await expect(page.locator('main')).toBeVisible(); // wait until page stabilizes

    // Assert: AXE rules are observed.
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('should name both datetime sub-inputs with the label plus distinct qualifiers', async ({ page }) => {
    // Arrange: Start on custom components page; the datetime row is the only one rendering
    // both sub-inputs (cc-dateTimePicker), each named after the same visible <label>.
    await page.goto('/dev/components');
    const dateInput = page.locator('[data-testid="dateId_cc-dateTimePicker_input"]');
    const timeInput = page.locator('[data-testid="timeId_cc-dateTimePicker_input"]');

    // Act: Read the name references of both sub-inputs.
    const dateName = await dateInput.getAttribute('aria-labelledby');
    const timeName = await timeInput.getAttribute('aria-labelledby');

    // Assert: Same visible label first (stays a prefix for voice control), then a distinct
    // hidden qualifier - the two inputs must never end up with one shared accessible name.
    expect(dateName, 'date input should be labelled by label + date qualifier').toBe('cc-dateTimePicker-label dateId_cc-dateTimePicker_qualifier');
    expect(timeName, 'time input should be labelled by label + time qualifier').toBe('cc-dateTimePicker-label timeId_cc-dateTimePicker_qualifier');
    expect(dateName, 'the two inputs must not share one accessible name').not.toBe(timeName);
    await expect(page.locator('#dateId_cc-dateTimePicker_qualifier'), 'date qualifier should carry the translated name').toHaveText('Date');
    await expect(page.locator('#timeId_cc-dateTimePicker_qualifier'), 'time qualifier should carry the translated name').toHaveText('Time');
  });
});
