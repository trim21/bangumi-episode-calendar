namespace global {
  declare module '*.html' {
    const content: string
    export = content;
  }
}

declare var BANGUMI_CALENDAR: KVNamespace<string>
