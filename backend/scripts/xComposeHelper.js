/**
 * Local helper for crossposting to X without the (paid) API.
 *
 * Run on your own computer with `npm run x-helper`. The editor sends the Twitter thread here when
 * saving; this opens Chrome with a dedicated profile, fills in the thread (text, images, alt text),
 * and waits for you to review it and click Post yourself. Once X confirms the post, the new post's
 * ID is returned to the editor so it can be saved as the post's social link.
 *
 * The first time it runs, log in to X in the Chrome window it opens. The session is kept in
 * ~/.x-compose-helper-profile for subsequent runs.
 */
import express from 'express';
import os from 'os';
import path from 'path';
import { chromium } from 'playwright';

import { NETWORK_LIMITS } from '../../frontend/js/helpers/editorHelpers.js';
import { getImages, processSocialPost } from '../helpers/social.js';

const PORT = Number(process.env.X_HELPER_PORT) || 5055;
const PROFILE_DIR =
  process.env.X_HELPER_PROFILE ||
  path.join(os.homedir(), '.x-compose-helper-profile');
const ALLOWED_ORIGINS = (
  process.env.X_HELPER_ORIGINS ||
  'https://www.mollywhite.net,https://mollywhite.net,http://localhost:5001'
).split(',');

// How long to wait for you to click Post before giving up
const POST_TIMEOUT_MS = 15 * 60 * 1000;

let browserContext = null;
let busy = false;

async function getBrowserContext() {
  if (browserContext) {
    return browserContext;
  }
  browserContext = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    // Playwright's defaults tell Chrome to skip the OS keychain, which would leave the X session
    // cookies in the profile directory effectively unencrypted. Use the real keychain instead.
    ignoreDefaultArgs: ['--use-mock-keychain', '--password-store=basic'],
  });
  browserContext.on('close', () => {
    browserContext = null;
  });
  return browserContext;
}

/**
 * Type text into the focused X composer. The composer is a rich text editor, so newlines need to
 * be entered as keypresses rather than inserted as part of the text.
 */
async function typeText(page, text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) {
      await page.keyboard.insertText(lines[i]);
    }
    if (i < lines.length - 1) {
      await page.keyboard.press('Enter');
    }
  }
}

/**
 * Add alt text to the most recently attached images in the composer. Returns a list of warnings for
 * any images where this couldn't be done, so they can be fixed by hand before posting.
 */
async function addAltText(page, images, postIndex) {
  const warnings = [];
  const editButtons = page.getByRole('button', {
    name: /add description|edit image description/i,
  });
  const count = await editButtons.count();
  // Attachments for the post being composed are the last ones in the composer
  const offset = count - images.length;
  for (let i = 0; i < images.length; i++) {
    const { alt } = images[i];
    if (!alt) {
      continue;
    }
    try {
      if (offset < 0) {
        throw new Error('description button not found');
      }
      await editButtons.nth(offset + i).click();
      const altInput = page.getByRole('textbox', { name: /description/i });
      await altInput.waitFor({ timeout: 5000 });
      await altInput.fill(alt.substring(0, NETWORK_LIMITS.twitter.alt));
      await page.getByRole('button', { name: /^save$/i }).click();
      await altInput.waitFor({ state: 'detached', timeout: 5000 });
    } catch (err) {
      warnings.push(
        `Couldn't add alt text to image ${i + 1} in post ${postIndex + 1} (${err.message}). Add it by hand before posting.`,
      );
    }
  }
  return warnings;
}

/**
 * Fill in the X composer with the given thread, then wait for the user to post it.
 * Resolves with the ID of the first post in the thread.
 */
async function composeThread(posts, imagesMap) {
  const context = await getBrowserContext();
  const page = await context.newPage();

  try {
    // Start listening before the user can post, so the response isn't missed
    const postedPromise = page
      .waitForResponse(
        (resp) =>
          resp.request().method() === 'POST' &&
          /\/CreateTweet(\?|$)/.test(new URL(resp.url()).pathname),
        { timeout: POST_TIMEOUT_MS },
      )
      .then(async (resp) => {
        const body = await resp.json();
        const id = body?.data?.create_tweet?.tweet_results?.result?.rest_id;
        if (!id) {
          throw new Error(
            `X responded to the post without a post ID: ${JSON.stringify(body?.errors || body).substring(0, 500)}`,
          );
        }
        return id;
      });
    // The page closing (e.g. you close the tab to cancel) should fail the request rather than hang
    const closedPromise = new Promise((_, reject) =>
      page.once('close', () =>
        reject(new Error('The X tab was closed before posting')),
      ),
    );
    // If filling in the composer fails, these are never awaited; don't let them become unhandled
    // rejections when the page eventually closes.
    postedPromise.catch(() => {});
    closedPromise.catch(() => {});

    await page.goto('https://x.com/compose/post');
    const firstTextarea = page.locator('[data-testid="tweetTextarea_0"]');
    try {
      await firstTextarea.waitFor({ timeout: 30000 });
    } catch {
      throw new Error(
        "The X composer did not load. If X is asking you to log in, log in in the helper's Chrome window and save again.",
      );
    }

    const warnings = [];
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      if (i > 0) {
        await page.locator('[data-testid="addButton"]').click();
      }
      const textarea = page.locator(`[data-testid="tweetTextarea_${i}"]`);
      await textarea.waitFor();
      await textarea.click();
      await typeText(page, post.text);

      if (post.images.length) {
        // The file input attaches to whichever post in the thread is focused
        await page
          .locator('input[data-testid="fileInput"]')
          .first()
          .setInputFiles(
            post.images.map((image, j) => {
              const { buffer, mimeType } = imagesMap[image.href];
              return {
                name: `image-${i + 1}-${j + 1}.${mimeType.split('/')[1] || 'jpg'}`,
                mimeType,
                buffer,
              };
            }),
          );
        warnings.push(...(await addAltText(page, post.images, i)));
      }
    }

    for (const warning of warnings) {
      console.warn(warning);
    }
    console.log('Thread is ready. Review it in Chrome and click Post.');
    await page.bringToFront();

    const postId = await Promise.race([postedPromise, closedPromise]);

    // Give X a moment to finish posting the rest of the thread before closing the tab. If anything
    // failed before this point, the tab is left open so you can see what happened (or log in).
    await page.waitForTimeout(5000);
    if (!page.isClosed()) {
      await page.close();
    }
    return { postId, warnings };
  } catch (err) {
    console.error('Failed while composing on X; leaving the tab open.');
    throw err;
  }
}

const app = express();

// Only the editor may use this helper. Requiring a JSON body means browsers send a CORS preflight,
// so other sites can't trigger a compose with a simple form post.
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    res.status(403).json({ error: `Origin not allowed: ${origin}` });
    return;
  }
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Allow-Private-Network', 'true');
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: '1mb' }));

app.post('/compose', async (req, res) => {
  if (!req.is('application/json') || !Array.isArray(req.body?.blocks)) {
    res.status(400).json({ error: 'Expected a JSON body with "blocks"' });
    return;
  }
  if (busy) {
    res.status(409).json({ error: 'Already composing a post on X' });
    return;
  }
  busy = true;
  try {
    const posts = processSocialPost(req.body.blocks, 'twitter');
    const images = await getImages({ twitter: posts });
    const { postId, warnings } = await composeThread(posts, images);
    console.log(`Posted to X: https://x.com/i/status/${postId}`);
    res.json({ postId, warnings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || String(err) });
  } finally {
    busy = false;
  }
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`X compose helper listening on http://localhost:${PORT}`);
  console.log(`Accepting requests from: ${ALLOWED_ORIGINS.join(', ')}`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // Most likely another copy of the helper is already running. Exit cleanly so that, when started
    // alongside the site with npm-run-all, this doesn't take the site down with it.
    console.warn(
      `X compose helper: port ${PORT} is already in use (is the helper already running?). Not starting another.`,
    );
    process.exit(0);
  }
  throw err;
});
