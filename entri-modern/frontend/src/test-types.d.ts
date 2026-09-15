declare module 'vitest' {
  export const describe: any;
  export const test: any;
  export const expect: any;
  export const vi: any;
  export const beforeEach: any;
  export const afterEach: any;
}

declare module '@testing-library/react' {
  export const render: any;
  export const screen: any;
  export const act: any;
  export const fireEvent: any;
  export const waitFor: any;
}
