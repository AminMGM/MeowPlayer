// The Home screen greetings: each one has a time window, the days it can
// appear on, optional context tags (first launch, returning, long session)
// and a weight. pickGreeting() chooses one that fits the moment.

export type GreetingDay = 'any' | 'weekday' | 'weekend'

export interface Greeting {
  id: number
  icon: string
  text: string
  startHour: number
  endHour: number
  days: GreetingDay
  tags: string[]
  weight: number
}

export interface GreetingContext {
  hour: number
  isWeekend: boolean
  firstLaunch: boolean
  returning: boolean
  longSession: boolean
  lastShownId: number | null
}

export const GREETINGS: Greeting[] = [
  {"id":1,"icon":"☀️","text":"Rise and shine, let's set the tone.","startHour":5,"endHour":8,"days":"any","tags":["earlyMorning"],"weight":1},
  {"id":2,"icon":"☀️","text":"Early bird gets the best playlist.","startHour":5,"endHour":8,"days":"any","tags":["earlyMorning"],"weight":1},
  {"id":3,"icon":"🌅","text":"Sun's barely up — ease into it.","startHour":5,"endHour":8,"days":"any","tags":["earlyMorning"],"weight":1},
  {"id":4,"icon":"🌅","text":"A calm start deserves a calm soundtrack.","startHour":5,"endHour":8,"days":"any","tags":["earlyMorning"],"weight":1},
  {"id":5,"icon":"☀️","text":"Coffee's brewing, so is the mood.","startHour":5,"endHour":8,"days":"any","tags":["earlyMorning"],"weight":1},
  {"id":6,"icon":"🌅","text":"First light, first track.","startHour":5,"endHour":8,"days":"any","tags":["earlyMorning"],"weight":1},
  {"id":7,"icon":"☀️","text":"Quiet hours, perfect for soft melodies.","startHour":5,"endHour":8,"days":"any","tags":["earlyMorning"],"weight":1},
  {"id":8,"icon":"🌅","text":"The world's still waking up — are you?","startHour":5,"endHour":8,"days":"any","tags":["earlyMorning"],"weight":1},
  {"id":9,"icon":"☀️","text":"Start your morning on the right note.","startHour":5,"endHour":8,"days":"any","tags":["earlyMorning"],"weight":1},
  {"id":10,"icon":"🌅","text":"Dawn calls for something gentle.","startHour":5,"endHour":8,"days":"any","tags":["earlyMorning"],"weight":1},
  {"id":11,"icon":"☕","text":"Morning momentum starts here.","startHour":8,"endHour":11,"days":"any","tags":["morning"],"weight":1},
  {"id":12,"icon":"☕","text":"Time to get the day moving.","startHour":8,"endHour":11,"days":"any","tags":["morning"],"weight":1},
  {"id":13,"icon":"☕","text":"Fuel up with your favorite beats.","startHour":8,"endHour":11,"days":"any","tags":["morning"],"weight":1},
  {"id":14,"icon":"🌤","text":"A fresh playlist for a fresh start.","startHour":8,"endHour":11,"days":"any","tags":["morning"],"weight":1},
  {"id":15,"icon":"☕","text":"Let's turn this morning up a notch.","startHour":8,"endHour":11,"days":"any","tags":["morning"],"weight":1},
  {"id":16,"icon":"🌤","text":"Productivity pairs well with a good mix.","startHour":8,"endHour":11,"days":"any","tags":["morning"],"weight":1},
  {"id":17,"icon":"☕","text":"Mid-morning energy, right this way.","startHour":8,"endHour":11,"days":"any","tags":["morning"],"weight":1},
  {"id":18,"icon":"🌤","text":"Shake off the sleep with something upbeat.","startHour":8,"endHour":11,"days":"any","tags":["morning"],"weight":1},
  {"id":19,"icon":"☕","text":"Your soundtrack for getting things done.","startHour":8,"endHour":11,"days":"any","tags":["morning"],"weight":1},
  {"id":20,"icon":"🌤","text":"Morning's calling — answer with music.","startHour":8,"endHour":11,"days":"any","tags":["morning"],"weight":1},
  {"id":21,"icon":"🌞","text":"Midday pick-me-up, coming right up.","startHour":11,"endHour":15,"days":"any","tags":["midday"],"weight":1},
  {"id":22,"icon":"🌞","text":"Lunch break deserves a good soundtrack.","startHour":11,"endHour":15,"days":"any","tags":["midday"],"weight":1},
  {"id":23,"icon":"🌞","text":"Keep the momentum going into the afternoon.","startHour":11,"endHour":15,"days":"any","tags":["midday"],"weight":1},
  {"id":24,"icon":"🌞","text":"Bright day, brighter playlist.","startHour":11,"endHour":15,"days":"any","tags":["midday"],"weight":1},
  {"id":25,"icon":"🌞","text":"A little music break never hurt anyone.","startHour":11,"endHour":15,"days":"any","tags":["midday"],"weight":1},
  {"id":26,"icon":"🌞","text":"Halfway through the day — treat yourself.","startHour":11,"endHour":15,"days":"any","tags":["midday"],"weight":1},
  {"id":27,"icon":"🌞","text":"Sunlit hours call for feel-good tracks.","startHour":11,"endHour":15,"days":"any","tags":["midday"],"weight":1},
  {"id":28,"icon":"🌞","text":"Recharge with a few favorite songs.","startHour":11,"endHour":15,"days":"any","tags":["midday"],"weight":1},
  {"id":29,"icon":"🌞","text":"Midday groove, no skipping required.","startHour":11,"endHour":15,"days":"any","tags":["midday"],"weight":1},
  {"id":30,"icon":"🌞","text":"The afternoon slump stops here.","startHour":11,"endHour":15,"days":"any","tags":["midday"],"weight":1},
  {"id":31,"icon":"🍵","text":"Afternoon lull? Let's fix that.","startHour":15,"endHour":18,"days":"any","tags":["afternoon"],"weight":1},
  {"id":32,"icon":"🍵","text":"Second wind starts with the right track.","startHour":15,"endHour":18,"days":"any","tags":["afternoon"],"weight":1},
  {"id":33,"icon":"🍵","text":"Wind down the workday, one song at a time.","startHour":15,"endHour":18,"days":"any","tags":["afternoon"],"weight":1},
  {"id":34,"icon":"🍵","text":"Golden hour's close — set the mood early.","startHour":15,"endHour":18,"days":"any","tags":["afternoon"],"weight":1},
  {"id":35,"icon":"🍵","text":"A little rhythm for the rest of the day.","startHour":15,"endHour":18,"days":"any","tags":["afternoon"],"weight":1},
  {"id":36,"icon":"🍵","text":"Push through with something upbeat.","startHour":15,"endHour":18,"days":"any","tags":["afternoon"],"weight":1},
  {"id":37,"icon":"🍵","text":"Almost evening — keep the energy up.","startHour":15,"endHour":18,"days":"any","tags":["afternoon"],"weight":1},
  {"id":38,"icon":"🍵","text":"Late afternoon calls for a steady beat.","startHour":15,"endHour":18,"days":"any","tags":["afternoon"],"weight":1},
  {"id":39,"icon":"🍵","text":"Shake off the day's weight with music.","startHour":15,"endHour":18,"days":"any","tags":["afternoon"],"weight":1},
  {"id":40,"icon":"🍵","text":"The home stretch sounds better with a soundtrack.","startHour":15,"endHour":18,"days":"any","tags":["afternoon"],"weight":1},
  {"id":41,"icon":"🌆","text":"Evening's here — time to unwind.","startHour":18,"endHour":21,"days":"any","tags":["evening"],"weight":1},
  {"id":42,"icon":"🌆","text":"Dinner's better with background music.","startHour":18,"endHour":21,"days":"any","tags":["evening"],"weight":1},
  {"id":43,"icon":"🌆","text":"Golden light, golden playlist.","startHour":18,"endHour":21,"days":"any","tags":["evening"],"weight":1},
  {"id":44,"icon":"🌆","text":"The day's winding down, let the music take over.","startHour":18,"endHour":21,"days":"any","tags":["evening"],"weight":1},
  {"id":45,"icon":"🌆","text":"Settle in for a relaxed evening.","startHour":18,"endHour":21,"days":"any","tags":["evening"],"weight":1},
  {"id":46,"icon":"🌆","text":"Evening calm, one track at a time.","startHour":18,"endHour":21,"days":"any","tags":["evening"],"weight":1},
  {"id":47,"icon":"🌆","text":"Let the evening set the mood.","startHour":18,"endHour":21,"days":"any","tags":["evening"],"weight":1},
  {"id":48,"icon":"🌆","text":"Day's done — now it's your time.","startHour":18,"endHour":21,"days":"any","tags":["evening"],"weight":1},
  {"id":49,"icon":"🌆","text":"A little music to close out the day.","startHour":18,"endHour":21,"days":"any","tags":["evening"],"weight":1},
  {"id":50,"icon":"🌆","text":"Evenings are made for good playlists.","startHour":18,"endHour":21,"days":"any","tags":["evening"],"weight":1},
  {"id":51,"icon":"🌙","text":"Night's settling in, let the music follow.","startHour":21,"endHour":24,"days":"any","tags":["night"],"weight":1},
  {"id":52,"icon":"🌙","text":"Lights down, volume up.","startHour":21,"endHour":24,"days":"any","tags":["night"],"weight":1},
  {"id":53,"icon":"🌙","text":"The night is young — so is this playlist.","startHour":21,"endHour":24,"days":"any","tags":["night"],"weight":1},
  {"id":54,"icon":"🌙","text":"Unwind with something easy on the ears.","startHour":21,"endHour":24,"days":"any","tags":["night"],"weight":1},
  {"id":55,"icon":"🌙","text":"Nighttime calm starts with the right song.","startHour":21,"endHour":24,"days":"any","tags":["night"],"weight":1},
  {"id":56,"icon":"🌙","text":"A quiet night, a good soundtrack.","startHour":21,"endHour":24,"days":"any","tags":["night"],"weight":1},
  {"id":57,"icon":"🌙","text":"The city's winding down — you don't have to.","startHour":21,"endHour":24,"days":"any","tags":["night"],"weight":1},
  {"id":58,"icon":"🌙","text":"Let the night carry the rhythm.","startHour":21,"endHour":24,"days":"any","tags":["night"],"weight":1},
  {"id":59,"icon":"🌙","text":"Darkness outside, good vibes inside.","startHour":21,"endHour":24,"days":"any","tags":["night"],"weight":1},
  {"id":60,"icon":"🌙","text":"Time to slow things down a little.","startHour":21,"endHour":24,"days":"any","tags":["night"],"weight":1},
  {"id":61,"icon":"🌟","text":"It's a late-night jam session.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":62,"icon":"✨","text":"The night owls' playlist awaits.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":63,"icon":"🌙","text":"Everyone else is asleep — the music isn't.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":64,"icon":"✨","text":"Late hours, loud thoughts, good music.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":65,"icon":"🌌","text":"3 AM hits different with the right track.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":66,"icon":"✨","text":"When the world's quiet, turn it up.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":67,"icon":"🌠","text":"Late-night energy, no apologies.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":68,"icon":"✨","text":"The best ideas happen past midnight.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":69,"icon":"🌙","text":"Insomnia's better with a soundtrack.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":70,"icon":"✨","text":"Still up? Might as well vibe.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":71,"icon":"🌌","text":"Midnight thoughts need a midnight playlist.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":72,"icon":"✨","text":"The quiet hours are yours.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":73,"icon":"🌙","text":"Late night, no rules.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":74,"icon":"✨","text":"This is when the real listening happens.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":75,"icon":"🌌","text":"Night shift for your ears.","startHour":0,"endHour":5,"days":"any","tags":["lateNight"],"weight":1},
  {"id":76,"icon":"🎉","text":"Weekend mode: officially on.","startHour":0,"endHour":24,"days":"weekend","tags":["weekend"],"weight":1},
  {"id":77,"icon":"🎉","text":"No alarms, no rules — just music.","startHour":0,"endHour":24,"days":"weekend","tags":["weekend"],"weight":1},
  {"id":78,"icon":"🎉","text":"Saturday sounds better with the volume up.","startHour":0,"endHour":24,"days":"weekend","tags":["weekend"],"weight":1},
  {"id":79,"icon":"🎉","text":"Sunday's made for slow mornings and good songs.","startHour":0,"endHour":24,"days":"weekend","tags":["weekend"],"weight":1},
  {"id":80,"icon":"🎉","text":"Weekend energy, your way.","startHour":0,"endHour":24,"days":"weekend","tags":["weekend"],"weight":1},
  {"id":81,"icon":"🎉","text":"Two days, zero obligations, endless playlists.","startHour":0,"endHour":24,"days":"weekend","tags":["weekend"],"weight":1},
  {"id":82,"icon":"👋","text":"Welcome back — we kept your playlists warm.","startHour":0,"endHour":24,"days":"any","tags":["returning"],"weight":1},
  {"id":83,"icon":"👋","text":"Missed you. Your library missed you too.","startHour":0,"endHour":24,"days":"any","tags":["returning"],"weight":1},
  {"id":84,"icon":"👋","text":"Back again? Let's pick up where you left off.","startHour":0,"endHour":24,"days":"any","tags":["returning"],"weight":1},
  {"id":85,"icon":"👋","text":"Good to see you — ready for round two?","startHour":0,"endHour":24,"days":"any","tags":["returning"],"weight":1},
  {"id":86,"icon":"👋","text":"It's been a while. Let's make up for it.","startHour":0,"endHour":24,"days":"any","tags":["returning"],"weight":1},
  {"id":87,"icon":"🔥","text":"Still going strong — love the dedication.","startHour":0,"endHour":24,"days":"any","tags":["longSession"],"weight":1},
  {"id":88,"icon":"🔥","text":"This session's turning into a marathon.","startHour":0,"endHour":24,"days":"any","tags":["longSession"],"weight":1},
  {"id":89,"icon":"🔥","text":"You've been at this a while — take a bow.","startHour":0,"endHour":24,"days":"any","tags":["longSession"],"weight":1},
  {"id":90,"icon":"🔥","text":"Deep in the groove, huh?","startHour":0,"endHour":24,"days":"any","tags":["longSession"],"weight":1},
  {"id":91,"icon":"🔥","text":"That's a serious listening streak.","startHour":0,"endHour":24,"days":"any","tags":["longSession"],"weight":1},
  {"id":92,"icon":"🎧","text":"Welcome to MeowPlayer — let's find your sound.","startHour":0,"endHour":24,"days":"any","tags":["firstLaunch"],"weight":1},
  {"id":93,"icon":"🎧","text":"First time here? Let's get you set up.","startHour":0,"endHour":24,"days":"any","tags":["firstLaunch"],"weight":1},
  {"id":94,"icon":"🎧","text":"Your library starts now.","startHour":0,"endHour":24,"days":"any","tags":["firstLaunch"],"weight":1},
  {"id":95,"icon":"🎧","text":"New player, new playlists — let's go.","startHour":0,"endHour":24,"days":"any","tags":["firstLaunch"],"weight":1},
  {"id":96,"icon":"🎶","text":"Good music, good timing.","startHour":0,"endHour":24,"days":"any","tags":["general"],"weight":1},
  {"id":97,"icon":"🎶","text":"Every session deserves a soundtrack.","startHour":0,"endHour":24,"days":"any","tags":["general"],"weight":1},
  {"id":98,"icon":"🎶","text":"Let's make this one count.","startHour":0,"endHour":24,"days":"any","tags":["general"],"weight":1},
  {"id":99,"icon":"🎶","text":"Your library, your rules.","startHour":0,"endHour":24,"days":"any","tags":["general"],"weight":1},
  {"id":100,"icon":"🎶","text":"Press play — the rest takes care of itself.","startHour":0,"endHour":24,"days":"any","tags":["general"],"weight":1},
]

const dayMatches = (greeting: Greeting, isWeekend: boolean): boolean =>
  greeting.days === 'any' || (greeting.days === 'weekend') === isWeekend

const hourMatches = (greeting: Greeting, hour: number): boolean =>
  greeting.startHour === 0 && greeting.endHour === 24
    ? true
    : hour >= greeting.startHour && hour < greeting.endHour

function weightedPick(pool: Greeting[]): Greeting {
  const total = pool.reduce((sum, greeting) => sum + Math.max(0.01, greeting.weight), 0)
  let roll = Math.random() * total
  for (const greeting of pool) {
    roll -= Math.max(0.01, greeting.weight)
    if (roll <= 0) return greeting
  }
  return pool[pool.length - 1]
}

/**
 * One greeting per Home screen load: filters by the local clock and day, gives
 * context-specific messages (first launch, coming back after a week, a very
 * long session) a 40% chance, never repeats the previous greeting, and falls
 * back to the general pool if the clock filter comes up empty.
 */
export function pickGreeting(context: GreetingContext): Greeting {
  const base = GREETINGS.filter(
    (greeting) => hourMatches(greeting, context.hour) && dayMatches(greeting, context.isWeekend),
  )

  const flags = [
    context.firstLaunch ? 'firstLaunch' : null,
    context.returning ? 'returning' : null,
    context.longSession ? 'longSession' : null,
  ].filter((flag): flag is string => Boolean(flag))

  let pool = base.length ? base : GREETINGS.filter((greeting) => greeting.tags.includes('general'))

  if (flags.length && Math.random() < 0.4) {
    const flag = flags[Math.floor(Math.random() * flags.length)]
    const contextual = GREETINGS.filter((greeting) => greeting.tags.includes(flag))
    if (contextual.length) pool = contextual
  }

  const withoutLast =
    context.lastShownId !== null && pool.length > 1
      ? pool.filter((greeting) => greeting.id !== context.lastShownId)
      : pool

  return weightedPick(withoutLast.length ? withoutLast : pool)
}
