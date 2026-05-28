import { generateScript } from '../pipeline'
import type { Pipeline } from '../pipeline'

describe('generateScript', () => {
  it('generates a fetch step with no auth', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Data',
          connector_id: null, url: 'https://api.example.com/data',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        {
          type: 'output', id: 'step_2', label: 'Out',
          sourceId: 'step_1', mappings: [{ from: 'value', to: 'result' }],
        },
      ],
    }
    const script = generateScript(pipeline)
    expect(script).toContain("const step_1 = await fetch(")
    expect(script).toContain('https://api.example.com/data')
    expect(script).toContain("return {")
    expect(script).toContain("result: step_1?.value")
  })

  it('generates bearer auth header using getSecret', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Data',
          connector_id: null, url: 'https://api.example.com',
          method: 'GET', headers: [], body: null,
          auth: { type: 'bearer', secret: 'MY_KEY' }, variables: {},
        },
        { type: 'output', id: 'step_2', label: 'Out', sourceId: 'step_1', mappings: [] },
      ],
    }
    const script = generateScript(pipeline)
    expect(script).toContain("Authorization")
    expect(script).toContain("getSecret('MY_KEY')")
  })

  it('generates a pick step with dot-notation paths', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Data',
          connector_id: null, url: 'https://api.example.com',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        {
          type: 'pick', id: 'step_2', label: 'Pick',
          sourceId: 'step_1', fields: ['weather.temp', 'weather.wind'],
        },
        { type: 'output', id: 'step_3', label: 'Out', sourceId: 'step_2', mappings: [] },
      ],
    }
    const script = generateScript(pipeline)
    expect(script).toContain('temp: step_1?.weather?.temp')
    expect(script).toContain('wind: step_1?.weather?.wind')
  })

  it('generates a rename step', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Data',
          connector_id: null, url: 'https://api.example.com',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        {
          type: 'rename', id: 'step_2', label: 'Rename',
          sourceId: 'step_1', mappings: [{ from: 'temp', to: 'temperature_f' }],
        },
        { type: 'output', id: 'step_3', label: 'Out', sourceId: 'step_2', mappings: [] },
      ],
    }
    const script = generateScript(pipeline)
    expect(script).toContain('temperature_f: step_1?.temp')
  })

  it('generates a merge step', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Sales',
          connector_id: null, url: 'https://api.example.com/sales',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        {
          type: 'fetch', id: 'step_2', label: 'Inventory',
          connector_id: null, url: 'https://api.example.com/inventory',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        {
          type: 'merge', id: 'step_3', label: 'Merge',
          sources: [{ stepId: 'step_1', as: 'sales' }, { stepId: 'step_2', as: 'inventory' }],
        },
        { type: 'output', id: 'step_4', label: 'Out', sourceId: 'step_3', mappings: [] },
      ],
    }
    const script = generateScript(pipeline)
    expect(script).toContain('sales: step_1')
    expect(script).toContain('inventory: step_2')
  })

  it('generates a math step', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Data',
          connector_id: null, url: 'https://api.example.com',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        {
          type: 'math', id: 'step_2', label: 'Calc',
          sourceId: 'step_1', left: 'revenue', operator: '-', right: 'cost', outputKey: 'profit',
        },
        { type: 'output', id: 'step_3', label: 'Out', sourceId: 'step_2', mappings: [] },
      ],
    }
    const script = generateScript(pipeline)
    expect(script).toContain('profit: step_1?.revenue - step_1?.cost')
  })

  it('wraps the whole script correctly', () => {
    const pipeline: Pipeline = {
      steps: [
        {
          type: 'fetch', id: 'step_1', label: 'Data',
          connector_id: null, url: 'https://api.example.com',
          method: 'GET', headers: [], body: null, auth: null, variables: {},
        },
        { type: 'output', id: 'step_2', label: 'Out', sourceId: 'step_1', mappings: [] },
      ],
    }
    const script = generateScript(pipeline)
    expect(script.trimStart()).toMatch(/^const step_1/)
    expect(script.trimEnd()).toMatch(/return \{[\s\S]*\}$/)
  })
})
