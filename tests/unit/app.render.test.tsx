import { describe, expect, it } from 'vitest';
import { render } from 'preact-render-to-string';
import { App } from '../../src/app';

/**
 * Render smoke test. Not a DOM test — it proves the whole component tree
 * renders without throwing, that the shell is there, and that the honest
 * wording (MNP, disclaimer, official checks) actually reaches the user.
 */
describe('App shell renders', () => {
  const html = render(<App />);

  it('shows the app name and the value proposition', () => {
    expect(html).toContain('PakDossier');
    expect(html).toContain('number');
  });

  it('tells the user it works offline', () => {
    expect(html).toContain('Offline engine');
  });

  it('starts on the empty state with a hint', () => {
    expect(html).toContain('Koi bhi Pakistani mobile number');
  });

  it('carries the disclaimer and official links', () => {
    expect(html).toContain('NADRA');
    expect(html).toContain('cnic.sims.pk');
    expect(html).toContain('668 / 667 / 76367');
  });

  it('offers both languages', () => {
    expect(html).toContain('Roman Urdu');
    expect(html).toContain('English');
  });

  it('renders the official launcher with the launch-only caveat', () => {
    expect(html).toContain('Official checks aur portals');
    expect(html).toContain('scrape nahi karta');
    expect(html).toContain('76367');
  });

  it('offers both input modes', () => {
    expect(html).toContain('Mobile number');
    expect(html).toContain('CNIC');
  });

  it('shows the live-provider panel in its idle state', () => {
    expect(html).toContain('Live providers');
    expect(html).toContain('Number daalein');
  });
});
