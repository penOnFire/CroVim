export type Mode='normal'|'insert'|'pass-through'|'link-hints'|'find'|'visual'|'vomnibar'|'help'|'marks';
export interface Settings {schemaVersion:1; keyMappings:Record<string,string>; passKeys:string[]; excludedPatterns:string[]; searchEngines:{keyword:string;name:string;url:string}[]; scrollStep:number; smoothScroll:boolean; hintCharacters:string; hintMode:'alphabet'|'filtered'; findRegex:boolean; findSmartCase:boolean; theme:'system'|'light'|'dark'; globalMarksUseUppercase:boolean; newTabBackground:boolean;}
export interface TabInfo {id:number; title?:string; url?:string; active:boolean; windowId:number; index:number; pinned?:boolean; muted?:boolean;}
export interface MarkRecord {url:string; scrollX:number; scrollY:number; hash?:string; tabId?:number; secret:string;}
