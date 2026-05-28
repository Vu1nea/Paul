export interface DataSource {
  id: string
  name: string
  script: string
  schedule: string
}

export async function runScript(_source: DataSource): Promise<void> {
  // stub — implemented in Task 6
}

export function registerCronJob(_source: DataSource): void {
  // stub — implemented in Task 6
}

export function stopCronJob(_id: string): void {
  // stub — implemented in Task 6
}
