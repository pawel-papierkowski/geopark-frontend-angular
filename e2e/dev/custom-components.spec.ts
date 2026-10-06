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

  test('keeps the form columns aligned across all rows on a narrow screen', async ({ page }) => {
    // Arrange: Narrow viewport, the width at which per-row grids used to resolve different
    // track sizes per row because each row only saw its own label/control/value content.
    await page.goto('/dev/components');
    await page.setViewportSize({ width: 480, height: 900 });
    await expect(page.locator('main')).toBeVisible();

    // Act: Read the horizontal edges of every label (column 1) and value cell (column 3).
    const labelEdges = await page.locator('#cc-mode-label, [data-testid$="-label"]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }),
    );
    const valueLefts = await page.locator('[data-testid$="-value"]').evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().left),
    );

    // Assert: All rows share the exact same column boundaries.
    expect(labelEdges.length, 'several labelled rows must be compared').toBeGreaterThan(1);
    expect(valueLefts.length, 'several value cells must be compared').toBeGreaterThan(1);
    const [firstLabel] = labelEdges;
    const [firstValueLeft] = valueLefts;
    for (const [index, edge] of labelEdges.entries()) {
      expect(edge.left, `label #${index} starts at the shared column 1 start`).toBe(firstLabel.left);
      expect(edge.right, `label #${index} ends at the shared column 1 end`).toBe(firstLabel.right);
    }
    for (const [index, left] of valueLefts.entries()) {
      expect(left, `value cell #${index} starts at the shared column 3 start`).toBe(firstValueLeft);
    }
  });
});
