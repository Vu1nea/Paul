// Minimal shape used for cron job registration — does not include output or pipeline_json columns.
export interface DataSource {
  id: string
  name: string
  script: string
  schedule: string
}
