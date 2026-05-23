/**
 * Base contract for all Paul widgets.
 *
 * Every widget receives exactly two props:
 *
 * @template C - Widget-specific config set by the user (e.g. { city: string, units: string })
 * @template D - Data shape returned by the server — widgets never fetch their own data
 *
 * Example usage:
 *   function MyWidget({ config, data }: WidgetProps<MyConfig, MyData>) { ... }
 */
export interface WidgetProps<
  C = Record<string, unknown>,
  D = Record<string, unknown>,
> {
  config: C
  data: D | null
}
