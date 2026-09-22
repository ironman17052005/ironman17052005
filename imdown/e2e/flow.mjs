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
await hotpot.getByRole('button', { name: /tips from people who went/ }).click()
const tip = await hotpot.locator('li', { hasText: 'Put your name down at KBox' }).count()
await hotpot.getByRole('button', { name: 'hide tips' }).click()
log(`card shows ${cost}; tips open on demand: ${tip === 1}`)
await page.screenshot({ path: `${out}/1-feed.png` })

// --- search narrows the feed, and clearing restores it ---
const total = await page.locator('article').count()
await page.getByLabel('Search plans').fill('karaoke')
await page.waitForFunction((n) => document.querySelectorAll('article').length < n, total)
const hits = await page.locator('article h3').allInnerTexts()
log(`search "karaoke" -> ${hits.length} result(s): ${hits.join(', ')}`)
await page.getByLabel('Search plans').fill('chinatown')
await page.waitForTimeout(200)
log(`search by area works: ${(await page.locator('article').count()) > 0}`)
await page.getByLabel('Search plans').fill('zzzznothing')
await page.waitForSelector('text=Nothing matches')
log('a query with no hits shows an empty state')
await page.getByRole('button', { name: 'Clear filters' }).click()
await page.waitForTimeout(200)
log(`clearing restores all ${await page.locator('article').count()} plans`)

// --- cost filter ---
await page.getByRole('button', { name: /^filters/ }).click()
await page.getByRole('button', { name: '$10', exact: true }).click()
await page.waitForTimeout(250)
const costs = await page.locator('article .text-brand2').allInnerTexts()
const allCheap = costs.every((c) => c === 'free' || parseInt(c.replace(/\D/g, ''), 10) <= 10)
log(`under $10 filter leaves only cheap plans: ${allCheap} (${costs.join(', ')})`)
await page.getByRole('button', { name: 'clear all' }).click()
await page.waitForTimeout(200)

// --- save a plan, then filter to saved ---
await page.locator('article').first().getByLabel('Save for later').click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: /^saved \(1\)/ }).click()
await page.waitForTimeout(250)
log(`saved filter shows ${await page.locator('article').count()} plan`)
await page.getByRole('button', { name: 'clear all' }).click()
await page.waitForTimeout(200)

// --- surprise me ---
await page.getByTitle('Pick something for tonight').click()
await page.waitForSelector('text=tonight, do this one')
const highlighted = await page.locator('article.border-brand2').count()
log(`dice highlighted ${highlighted} plan`)
await page.getByRole('button', { name: 'roll again' }).click()
await page.waitForTimeout(300)

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
await page.getByRole('button', { name: 'feed' }).click()
const doneNow = await page.locator('article', { hasText: 'Hot pot then karaoke' }).first().locator('text=/\\d+× done/').innerText()
log(`proof count now ${doneNow} (seed was 14× done)`)

// --- "make it mine" prefills rather than silently cloning ---
await page.locator('article', { hasText: 'Hot pot then karaoke' }).first().getByRole('button', { name: 'make it mine' }).click()
await page.waitForSelector('text=Make it yours')
const prefilled = await page.getByLabel('Title').inputValue()
log(`copy opens a prefilled sheet: "${prefilled}"`)
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
log(`escape closes the sheet: ${(await page.locator('text=Make it yours').count()) === 0}`)

await page.locator('article', { hasText: 'Hot pot then karaoke' }).first().getByRole('button', { name: 'make it mine' }).click()
await page.waitForSelector('text=Make it yours')
await page.getByLabel('Title').fill('Hot pot then karaoke')
await page.waitForSelector('text=/already exists/')
log('a duplicate title is flagged before posting')
await page.getByLabel('Title').fill('Hot pot then karaoke our way')
await page.getByRole('button', { name: 'Post it' }).click()
await page.waitForSelector('text=Hot pot then karaoke our way')
log('posted my own version as a new card')

// --- edit and delete, but only my own plans ---
const mine = page.locator('article', { hasText: 'our way' })
await mine.getByRole('button', { name: 'edit' }).click()
await page.waitForSelector('text=Edit your plan')
await page.getByLabel('Title').fill('Hot pot then karaoke edited')
await page.getByRole('button', { name: 'Save changes' }).click()
await page.waitForSelector('text=Hot pot then karaoke edited')
log('edited my own plan in place, no duplicate created')

const seeded = page.locator('article', { hasText: 'Night market crawl' })
log(`someone else's plan has no edit button: ${(await seeded.getByRole('button', { name: 'edit' }).count()) === 0}`)

page.once('dialog', (d) => d.accept())
await page.locator('article', { hasText: 'Hot pot then karaoke edited' }).getByRole('button', { name: 'delete' }).click()
await page.waitForTimeout(400)
log(`deleted after confirming: ${(await page.locator('article', { hasText: 'Hot pot then karaoke edited' }).count()) === 0}`)

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

// --- the app is installable and shares a preview ---
const manifest = await page.evaluate(async () => {
  const r = await fetch('/manifest.webmanifest')
  return r.ok ? (await r.json()).name : null
})
const iconOk = await page.evaluate(async () => (await fetch('/icon-192.png')).ok)
log(`installable: manifest name "${manifest}", icon served: ${iconOk}`)

// --- corrupt saved state does not white-screen ---
const crash = await ctx.newPage()
crash.on('pageerror', () => {}) // the crash under test is expected
await crash.goto(BASE)
await crash.evaluate(() => localStorage.setItem('imdown.demo.v2', 'not json at all'))
await crash.reload()
await crash.waitForSelector('text=that broke')
log('corrupt saved state shows a recovery screen, not a blank page')
await crash.getByRole('button', { name: 'Start fresh' }).click()
await crash.waitForSelector('text=Night market crawl')
log('"start fresh" clears it and the app comes back')
await crash.close()

// --- invite links: the only way a friend gets in without knowing your username ---
await page.getByRole('button', { name: /^friends/ }).click()
await page.waitForSelector('text=Invite a friend')
const inviteShown = await page.locator('text=/\\?add=clark/').count()
log(`friends tab offers an invite link: ${inviteShown > 0}`)

const inviteLink = `${BASE}?add=omar`
const invitee = await ctx.newPage()
await invitee.goto(inviteLink)
await invitee.waitForSelector('text=/Friend request sent to @omar|Already friends|Request already sent/')
const noteText = await invitee.locator('text=/Friend request sent to @omar|Already friends|Request already sent/').first().innerText()
const urlAfter = invitee.url()
log(`opening an invite sends the request: "${noteText}"; url cleaned: ${!urlAfter.includes('add=')}`)
await invitee.reload()
await invitee.waitForSelector('text=Night market crawl')
const resent = await invitee.locator('text=/Friend request sent to @omar/').count()
log(`a refresh does not send it again: ${resent === 0}`)
await invitee.close()

// --- it still opens with no connection ---
const off = await ctx.newPage()
await off.goto(BASE)
await off.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
await off.reload() // the second load is the one the worker controls
await off.waitForSelector('text=Night market crawl')
const controlled = await off.evaluate(() => !!navigator.serviceWorker.controller)

await ctx.setOffline(true)
await off.reload()
await off.waitForSelector('text=Night market crawl', { timeout: 10000 })
const offlineCount = await off.locator('article').count()
log(`offline: worker in control ${controlled}, feed still renders ${offlineCount} plans with no connection`)
await ctx.setOffline(false)
await off.close()

console.log(errors.length ? `ERRORS: ${errors.join(' | ')}` : 'no console/page errors')
await browser.close()
