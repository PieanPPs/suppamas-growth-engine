// Supabase / PostgREST hard-caps EVERY request at 1000 rows server-side (the `max-rows`
// setting), and this cap overrides any client-side `.limit()` — a `.limit(100000)` still
// returns only the first 1000 rows. The only way to read a table that can exceed 1000 rows
// is to page through it with `.range()` until a short page comes back. Several tables here
// grow one row per student per module/lesson/day/test and have already crossed 1000, which
// silently truncated reads — corrupting "does this row exist" checks and analytics totals.
export const PAGE_SIZE = 1000

// Minimal shape of a Supabase query that still needs a range applied. `makeQuery` must build
// a FRESH query on each call, because a PostgREST builder can only be awaited once.
type RangeableQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
}

/** Fetch every row of a query by paging in blocks of PAGE_SIZE. Throws on the first error. */
export async function fetchAllPaged<T>(makeQuery: () => RangeableQuery<T>): Promise<T[]> {
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const chunk = data ?? []
    all.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

/**
 * ISO timestamp for the start of the current academic term, or null if unset.
 * Analytics/dashboard pages should scope their growth-table reads to this instead of
 * pulling the school's entire all-time history — student_assessments alone grows by
 * roughly (subjects × sessions/week × weeks × class size) rows per term, so an
 * unfiltered read gets slower every term the school keeps using the system.
 *
 * `supabase` is typed `any` deliberately: the real Supabase client's generic .from()
 * overloads make TypeScript's structural check against any narrower shape blow up with
 * "type instantiation is excessively deep" at every call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTermStartISO(supabase: any, schoolId: string): Promise<string | null> {
  const { data } = await supabase
    .from('academic_settings').select('term_start_date').eq('school_id', schoolId).maybeSingle()
  return data?.term_start_date ? `${data.term_start_date}T00:00:00` : null
}
