export function restorePosition(x:{scrollX:number;scrollY:number;hash?:string}){if(x.hash)location.hash=x.hash;else scrollTo(x.scrollX,x.scrollY)}
