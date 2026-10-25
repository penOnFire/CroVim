export const complete=(query:string)=>chrome.runtime.sendMessage({type:'omnibar.complete',payload:{query}});
