import type { Plan, Profile } from '../types'

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString()

export const seedPeople: Profile[] = [
  { id: 'u_me', username: 'clark', displayName: 'Clark', emoji: '🦾' },
  { id: 'u_1', username: 'minh', displayName: 'Minh', emoji: '🐉' },
  { id: 'u_2', username: 'jess', displayName: 'Jess', emoji: '🌙' },
  { id: 'u_3', username: 'dre', displayName: 'Dre', emoji: '🏀' },
  { id: 'u_4', username: 'tina', displayName: 'Tina', emoji: '🍜' },
  { id: 'u_5', username: 'omar', displayName: 'Omar', emoji: '🎮' },
]

export const seedFriends = ['u_1', 'u_2', 'u_3', 'u_4', 'u_5']

type Seed = Omit<Plan, 'id' | 'createdBy'>

const p = (
  title: string,
  steps: string[],
  area: string,
  vibe: string[],
  cost: 1 | 2 | 3,
  hours: number,
  bestTime: string,
  doneCount: number,
  lastDone: number,
): Seed => ({ title, steps, area, vibe, cost, hours, bestTime, doneCount, lastDoneAt: daysAgo(lastDone) })

export const seedPlans: Seed[] = [
  p('Hot pot then karaoke', ['Hot pot at Tan Tan', 'Karaoke at KBox until 1am'], 'Houston · Chinatown', ['food', 'late night'], 2, 4, 'Fri/Sat night', 14, 1),
  p('Sunday pickleball + boba', ['Pickleball at Memorial Park courts', 'Boba at Teahouse'], 'Houston · Memorial', ['sport', 'chill'], 1, 3, 'Sun morning', 9, 2),
  p('Night market crawl', ['Viet Hoa parking lot night market', 'Late bánh mì run'], 'Houston · Bellaire', ['food', 'walk'], 1, 3, 'Sat night', 22, 0),
  p('Board game cafe war', ['Tea + Victory board game cafe', 'Loser buys ramen'], 'Houston · Midtown', ['games', 'chill'], 2, 4, 'Weeknight', 11, 3),
  p('Sunrise at the beach', ['Leave 4:30am for Galveston', 'Sunrise on the seawall', 'Breakfast tacos on the way back'], 'Galveston', ['outdoors', 'road trip'], 1, 6, 'Sat', 6, 5),
  p('Kolache + museum day', ['Kolache Factory', 'Free day at MFAH', 'Hermann Park walk'], 'Houston · Museum District', ['chill', 'walk'], 1, 5, 'Thu (free museum day)', 8, 4),
  p('Bowling + Whataburger', ['Bowling at Palace Lanes', 'Whataburger at midnight'], 'Houston · Bellaire', ['games', 'late night'], 2, 3, 'Fri night', 17, 1),
  p('Cook-off at someone\'s place', ['Everyone brings one dish', 'Blind taste ranking', 'Mario Kart after'], 'Anywhere', ['food', 'home'], 1, 4, 'Sat night', 13, 2),
  p('Thrift then rooftop', ['Thrift crawl on Westheimer', 'Rooftop drinks at sunset'], 'Houston · Montrose', ['walk', 'drinks'], 2, 4, 'Sat afternoon', 10, 6),
  p('Trail run + acai', ['Buffalo Bayou loop', 'Acai bowls after'], 'Houston · Buffalo Bayou', ['sport', 'outdoors'], 1, 2, 'Sun morning', 7, 2),
  p('Rockets game on a budget', ['Cheap upper deck tickets', 'Tacos at Tacos A Go Go after'], 'Houston · Downtown', ['sport', 'food'], 3, 4, 'Game night', 5, 9),
  p('Study session that turns into dinner', ['UH library 3rd floor', 'Pho at 8pm'], 'Houston · UH', ['chill', 'food'], 1, 5, 'Weeknight', 19, 0),
  p('Escape room then bubble waffles', ['Escape room in Chinatown', 'Bubble waffles at Snow Bear'], 'Houston · Chinatown', ['games', 'food'], 2, 3, 'Fri night', 12, 3),
  p('Late night drive + gas station snacks', ['Drive with no destination', 'Buc-ee\'s at 1am'], 'Anywhere', ['late night', 'road trip'], 1, 3, 'Any night', 21, 1),
  p('Volleyball at the park', ['Bring a net to Discovery Green', 'Paletas after'], 'Houston · Downtown', ['sport', 'outdoors'], 1, 3, 'Sat afternoon', 8, 7),
]
