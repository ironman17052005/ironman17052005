export type Id = string

export interface Profile {
  id: Id
  username: string
  displayName: string
  emoji: string
  /** How many of your circle must be down before a hangout is proposed. Min 2. */
  threshold: number
}

export interface Plan {
  id: Id
  title: string
  steps: string[]           // "Hot pot at Tan Tan" -> "Karaoke at KBox"
  area: string              // "Houston · Chinatown"
  vibe: string[]            // ["food", "late night"]
  costPerPerson: number     // dollars, per head, so a card is copyable without guesswork
  hours: number
  bestTime: string          // "Fri/Sat night"
  tips: string[]            // "Go before 7 or you wait an hour"
  doneCount: number         // how many groups actually did it
  lastDoneAt: string        // ISO
  createdBy: Id | null      // null = seeded
}

export interface Tap {
  planId: Id
  userId: Id
  at: string
}

/** Friendship requires acceptance. No one lands in your circle without your say-so. */
export interface FriendRequest {
  id: Id
  from: Id
  to: Id
  at: string
}

/**
 * A share is one link dropped into one group chat. Interest is scoped to the share,
 * so posting a plan publicly never reveals who is going out with you tonight.
 */
export interface Share {
  id: Id
  planId: Id
  by: Id
  at: string
}

export interface GuestInterest {
  shareId: Id
  name: string
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

export interface Recap {
  note: string
  photo: string | null   // data URL in demo, storage URL in live
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
  recap: Recap | null
  createdAt: string
}

export interface Snapshot {
  me: Profile
  people: Record<Id, Profile>
  friends: Id[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
  plans: Plan[]
  taps: Tap[]
  hangouts: Hangout[]
  shares: Share[]
  guestInterests: GuestInterest[]
}

export const MIN_THRESHOLD = 2
export const DEFAULT_THRESHOLD = 2

export interface Store {
  load(): Promise<Snapshot>
  subscribe(cb: () => void): () => void
  tap(planId: Id): Promise<void>
  untap(planId: Id): Promise<void>
  /** A friend who taps after a hangout already exists joins it instead of being stranded. */
  joinHangout(hangoutId: Id): Promise<void>
  voteTime(hangoutId: Id, slotId: Id): Promise<void>
  sendMessage(hangoutId: Id, text: string): Promise<void>
  markOutcome(hangoutId: Id, happened: boolean): Promise<void>
  addRecap(hangoutId: Id, note: string, photo: string | null): Promise<void>
  createPlan(input: Omit<Plan, 'id' | 'doneCount' | 'lastDoneAt' | 'createdBy'>): Promise<void>
  copyPlan(planId: Id): Promise<void>
  setThreshold(n: number): Promise<void>
  sendFriendRequest(username: string): Promise<string | null>
  acceptFriendRequest(id: Id): Promise<void>
  declineFriendRequest(id: Id): Promise<void>
  removeFriend(id: Id): Promise<void>
  createShare(planId: Id): Promise<Id>
  /** Public, no account: someone in a group chat taps the link and leaves a first name. */
  addGuestInterest(shareId: Id, name: string): Promise<string | null>
  getShare(shareId: Id): Promise<{ share: Share; plan: Plan; names: string[]; by: string } | null>
}
