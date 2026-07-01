// PostgREST caps unbounded SELECTs at 1000 rows by default. Several tables in this app
// grow one row per student per module/lesson/day/test and silently crossed that cap,
// which corrupted "does a row already exist" checks (causing duplicate inserts) and
// under-counted analytics. Any school-wide read of a growth table must pass an explicit
// high limit. 100k comfortably covers a single school across multiple academic years.
export const MAX_ROWS = 100000
