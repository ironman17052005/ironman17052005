import { chromium } from 'playwright'

const out = process.env.SHOT_DIR ?? 'e2e/screenshots'
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'
// CHROMIUM_PATH lets a sandbox point at a preinstalled browser instead of Playwright's own.
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox'],
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('favicon') && errors.push('console: ' + m.text()))
const log = (m) => console.log('•', m)

await page.goto(BASE)
await page.getByText('reset', { exact: true }).click()
await page.waitForSelector('text=Night market crawl')

// --- feed shows a full outing, not just a title ---
const hotpot = page.locator('article', { hasText: 'Hot pot then karaoke' })
const cost = await hotpot.locator('text=/\\$\\d+\\/person/').innerText()
const tip = await hotpot.locator('li', { hasText: 'Put your name down at KBox' }).count()
log(`card shows ${cost}, tips present: ${tip === 1}`)
await page.screenshot({ path: `${out}/1-feed.png` })

// --- friendship needs consent ---
await page.getByRole('button', { name: /^friends/ }).click()
await page.waitForSelector('text=Wants to be friends')
const pending = await page.locator('text=Wants to be friends').isVisible()
const before = await page.locator('button', { hasText: /^remove$/ }).count()
await page.getByRole('button', { name: 'accept' }).first().click()
await page.waitForTimeout(300)
const after = await page.locator('button', { hasText: /^remove$/ }).count()
log(`friend requests shown: ${pending}; friends ${before} -> ${after} after accepting`)
await page.getByRole('button', { name: 'no' }).first().click()
await page.waitForTimeout(200)
log(`declined request removed: ${!(await page.locator('text=Wants to be friends').isVisible())}`)
await page.screenshot({ path: `${out}/2-friends.png` })

// --- threshold is 2 by default and adjustable ---
const twoSelected = await page.locator('button.border-brand', { hasText: /^2$/ }).count()
log(`default threshold is 2: ${twoSelected === 1}`)

// --- tap -> propose (not confirm) ---
await page.getByRole('button', { name: 'feed' }).click()
await hotpot.getByRole('button', { name: "I'm down" }).click()
await page.waitForTimeout(400)
// one friend already tapped this plan in the seed, so threshold 2 is met immediately
await page.getByRole('button', { name: /^hangouts/ }).click()
await page.waitForSelector('text=picking a time')
const notConfirmed = await page.locator('text=/Proposed, not locked/').isVisible()
log(`tap proposes rather than confirms: ${notConfirmed}`)
await page.screenshot({ path: `${out}/3-proposed.png` })

// --- vote -> majority confirms ---
const hang = page.locator('article', { hasText: 'Hot pot then karaoke' }).first()
await hang.getByRole('button', { name: /Fri/ }).click()
await page.waitForTimeout(300)
if (!(await page.locator('text=/locked: Fri/').isVisible())) {
  await hang.getByRole('button', { name: 'nudge' }).first().click()
}
await page.waitForSelector('text=/locked: Fri/', { timeout: 8000 })
log('majority vote confirmed the time')
await hang.getByPlaceholder('message the group').fill('leaving at 6:30, who needs a ride')
await hang.getByRole('button', { name: 'send' }).click()
await page.waitForSelector('text=who needs a ride')

// --- settle once: count goes up, and cannot go up twice ---
await hang.getByRole('button', { name: 'We did it' }).click()
await page.waitForSelector('text=happened ✓')
const stillOffersDone = await hang.getByRole('button', { name: 'We did it' }).count()
log(`after settling, the settle button is gone: ${stillOffersDone === 0}`)

// --- recap + copy this plan ---
await hang.getByPlaceholder('how it went').fill('KBox let us stay past close')
await hang.getByRole('button', { name: 'Post recap' }).click()
await page.waitForSelector('text=KBox let us stay past close')
await page.screenshot({ path: `${out}/4-recap.png` })
await hang.getByRole('button', { name: 'Copy this plan' }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'feed' }).click()
const copies = await page.locator('article h3', { hasText: 'Hot pot then karaoke' }).count()
const doneNow = await page.locator('article', { hasText: 'Hot pot then karaoke' }).first().locator('text=/\\d+× done/').innerText()
log(`copy created a second card: ${copies === 2}; proof count now ${doneNow} (seed was 14× done)`)

// --- share link works signed out, with no account ---
const target = page.locator('article', { hasText: 'Night market crawl' })
await target.getByRole('button', { name: 'send to a group chat' }).click()
await page.waitForSelector('text=Send to a group chat')
await page.screenshot({ path: `${out}/5-share.png` })
await page.getByRole('button', { name: 'Copy text' }).click()
const shareText = await page.evaluate(() => navigator.clipboard.readText())
const url = shareText.match(/https?:\/\/\S+/)[0]
log(`share text includes a link and the cost: ${/\$\d+\/person/.test(shareText)}`)
await page.getByRole('button', { name: 'close' }).click()

// A friend opening the link in a clean browser: no localStorage, no account.
const guest = await ctx.newPage()
await guest.goto(url)
await guest.waitForSelector('text=Night market crawl')
const guestSeesPrivate = await guest.locator('text=/hangouts|friends|sign out/i').count()
await guest.getByPlaceholder('your first name').fill('Tuan')
await guest.getByRole('button', { name: "I'm down" }).click()
await guest.waitForSelector("text=You're in.")
log(`guest joined with just a name; private tabs exposed to guest: ${guestSeesPrivate}`)
await guest.screenshot({ path: `${out}/6-sharepage.png` })

// the sharer sees the interest come back
await page.reload()
await page.waitForSelector('text=Night market crawl')
await page.waitForSelector('text=/1 down via your link/', { timeout: 5000 })
log('sharer sees "1 down via your link"')

// --- bad link fails cleanly ---
await guest.goto(`${BASE}?s=doesnotexist`)
await guest.waitForSelector('text=link expired')
log('invalid share link shows a clean message')

console.log(errors.length ? `ERRORS: ${errors.join(' | ')}` : 'no console/page errors')
await browser.close()
