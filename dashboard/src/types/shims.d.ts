// Minimal shims so the repo remains editable even before installing Node dependencies.
// When you run `npm install` these declarations will be superseded by real types.

declare module '@fluentui/react-components' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const FluentProvider: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Title1: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Subtitle1: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Body1: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Caption1: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const webLightTheme: any
}

declare const process: {
  env: Record<string, string | undefined>
}

declare namespace JSX {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface IntrinsicElements {
    [elemName: string]: any
  }
}
