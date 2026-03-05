declare module 'asterisk-manager' {
  function ami(port: number, host: string, user: string, secret: string, keepAlive: boolean): unknown;
  export default ami;
}
