export type Id = string

export interface Profile {
  id: Id
  username: string
  displayName: string
  emoji: string
}

export interface Plan {
  id: Id
  title: string
  steps: string[]          // "Hot pot at Tan Tan" -> "Karaoke at Kbox"
  area: string             // "Houston · Chinatown"
  vibe: string[]           // ["food", "late night"]
  cost: 1 | 2 | 3          // $, $$, $$$
  hours: number            // rough duration
  bestTime: string         // "Fri/Sat night"
  doneCount: number        // how many groups actually did it
  lastDoneAt: string       // ISO
  createdBy: Id | null     // null = seeded
}

export interface Tap {
  planId: Id
  userId: Id
  at: string
}

export type HangoutStatus = 'voting' | 'confirmed' | 'done' | 'flopped'

export interface TimeSlot {
  id: Id
  label: string   // "Fri 7:00 PM"
  at: string      // ISO
  votes: Id[]
}

export interface Message {
  id: Id
  userId: Id
  text: string
  at: string
}

export interface Hangout {
  id: Id
  planId: Id
  members: Id[]
  status: HangoutStatus
  slots: TimeSlot[]
  chosenSlotId: Id | null
  messages: Message[]
  createdAt: string
}

export interface Snapshot {
  me: Profile
  people: Record<Id, Profile>
  friends: Id[]
  plans: Plan[]
  taps: Tap[]
  hangouts: Hangout[]
}

export const CONFIRM_THRESHOLD = 3

export interface Store {
  load(): Promise<Snapshot>
  subscribe(cb: () => void): () => void
  tap(planId: Id): Promise<void>
  untap(planId: Id): Promise<void>
  voteTime(hangoutId: Id, slotId: Id): Promise<void>
  sendMessage(hangoutId: Id, text: string): Promise<void>
  markOutcome(hangoutId: Id, happened: boolean): Promise<void>
  createPlan(input: Omit<Plan, 'id' | 'doneCount' | 'lastDoneAt' | 'createdBy'>): Promise<void>
  addFriend(username: string): Promise<string | null> // returns error text or null
}
