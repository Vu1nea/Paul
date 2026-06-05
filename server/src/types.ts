/** Minimal shape used for cron job registration — only the columns needed to schedule and run a script. */
export interface DataSource {
  id: string
  name: string
  script: string
  schedule: string
}
