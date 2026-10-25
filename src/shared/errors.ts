export class CroVimError extends Error {constructor(public code:string,message:string,public retryable=false){super(message);this.name='CroVimError';}}
export const asError=(e:unknown)=>e instanceof Error?e.message:String(e);
