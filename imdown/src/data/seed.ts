import { DEFAULT_THRESHOLD, type Plan, type Profile } from '../types'

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString()

const person = (id: string, username: string, displayName: string, emoji: string): Profile =>
  ({ id, username, displayName, emoji, threshold: DEFAULT_THRESHOLD })

export const seedPeople: Profile[] = [
  person('u_me', 'clark', 'Clark', '🦾'),
  person('u_1', 'minh', 'Minh', '🐉'),
  person('u_2', 'jess', 'Jess', '🌙'),
  person('u_3', 'dre', 'Dre', '🏀'),
  person('u_4', 'tina', 'Tina', '🍜'),
  person('u_5', 'omar', 'Omar', '🎮'),
]

/** Start with two friends. The rest arrive as friend requests you have to accept. */
export const seedFriends = ['u_1', 'u_2']
export const seedRequesters = ['u_3', 'u_4']

type Seed = Omit<Plan, 'id' | 'createdBy'>

const p = (
  title: string, steps: string[], area: string, vibe: string[],
  costPerPerson: number, hours: number, bestTime: string, tips: string[],
  doneCount: number, lastDone: number,
): Seed => ({ title, steps, area, vibe, costPerPerson, hours, bestTime, tips, doneCount, lastDoneAt: daysAgo(lastDone) })

export const seedPlans: Seed[] = [
  p('Hot pot then karaoke', ['Hot pot at Tan Tan', 'Karaoke at KBox until 1am'], 'Houston · Chinatown', ['food', 'late night'], 35, 4, 'Fri/Sat night',
    ['Put your name down at KBox before you sit down to eat, the wait is an hour after 9', 'Split one large broth, two is too much for four people'], 14, 1),
  p('Sunday pickleball + boba', ['Pickleball at Memorial Park courts', 'Boba at Teahouse'], 'Houston · Memorial', ['sport', 'chill'], 8, 3, 'Sun morning',
    ['Courts are free but full after 10am, get there by 8:30', 'Bring your own paddle, nobody lends'], 9, 2),
  p('Night market crawl', ['Viet Hoa parking lot night market', 'Late bánh mì run'], 'Houston · Bellaire', ['food', 'walk'], 20, 3, 'Sat night',
    ['Cash only at most stalls', 'Park on the street, the lot fills by 7'], 22, 0),
  p('Board game cafe war', ['Tea + Victory board game cafe', 'Loser buys ramen'], 'Houston · Midtown', ['games', 'chill'], 25, 4, 'Weeknight',
    ['There is a table fee per person, drinks are extra', 'Ask staff to teach you one game, it saves 30 minutes of rules'], 11, 3),
  p('Sunrise at the beach', ['Leave 4:30am for Galveston', 'Sunrise on the seawall', 'Breakfast tacos on the way back'], 'Galveston', ['outdoors', 'road trip'], 15, 6, 'Sat',
    ['Split gas, it is about an hour each way', 'Bring a blanket, it is cold before sunrise even in summer'], 6, 5),
  p('Kolache + museum day', ['Kolache Factory', 'Free day at MFAH', 'Hermann Park walk'], 'Houston · Museum District', ['chill', 'walk'], 12, 5, 'Thu (free museum day)',
    ['MFAH is free on Thursdays, check the hours first', 'Park at the garage, street parking is a trap'], 8, 4),
  p('Bowling + Whataburger', ['Bowling at Palace Lanes', 'Whataburger at midnight'], 'Houston · Bellaire', ['games', 'late night'], 22, 3, 'Fri night',
    ['Shoe rental is extra, wear socks', 'Two games per lane is the sweet spot'], 17, 1),
  p('Cook-off at someone\'s place', ['Everyone brings one dish', 'Blind taste ranking', 'Mario Kart after'], 'Anywhere', ['food', 'home'], 10, 4, 'Sat night',
    ['Assign categories or you get four desserts', 'Host does not cook, host does dishes'], 13, 2),
  p('Thrift then rooftop', ['Thrift crawl on Westheimer', 'Rooftop drinks at sunset'], 'Houston · Montrose', ['walk', 'drinks'], 40, 4, 'Sat afternoon',
    ['Start at the far end and walk back toward the car', 'Rooftops get a line at sunset, go 30 minutes early'], 10, 6),
  p('Trail run + acai', ['Buffalo Bayou loop', 'Acai bowls after'], 'Houston · Buffalo Bayou', ['sport', 'outdoors'], 10, 2, 'Sun morning',
    ['The loop is about 3 miles, walkable if someone is not a runner', 'Water fountains are only at the park end'], 7, 2),
  p('Rockets game on a budget', ['Cheap upper deck tickets', 'Tacos at Tacos A Go Go after'], 'Houston · Downtown', ['sport', 'food'], 45, 4, 'Game night',
    ['Buy resale the morning of, prices drop', 'Park a few blocks out and walk, garage parking doubles the cost'], 5, 9),
  p('Study session that turns into dinner', ['UH library 3rd floor', 'Pho at 8pm'], 'Houston · UH', ['chill', 'food'], 14, 5, 'Weeknight',
    ['3rd floor is quiet, 2nd floor is not', 'Book a group room a day ahead'], 19, 0),
  p('Escape room then bubble waffles', ['Escape room in Chinatown', 'Bubble waffles at Snow Bear'], 'Houston · Chinatown', ['games', 'food'], 38, 3, 'Fri night',
    ['Book online, walk-ins get the bad room', 'Four people is the right size, six is chaos'], 12, 3),
  p('Late night drive + gas station snacks', ['Drive with no destination', 'Buc-ee\'s at 1am'], 'Anywhere', ['late night', 'road trip'], 12, 3, 'Any night',
    ['Make the playlist before you leave', 'Buc-ee\'s brisket is the move, not the pastries'], 21, 1),
  p('Volleyball at the park', ['Bring a net to Discovery Green', 'Paletas after'], 'Houston · Downtown', ['sport', 'outdoors'], 5, 3, 'Sat afternoon',
    ['One person has to own a net, borrow from a rec center', 'Shade is gone after 2pm in summer'], 8, 7),
]
