export function moveSelection(direction:'forward'|'backward',granularity:'character'|'word'='character'){const s=getSelection();if(!s)return;try{s.modify('extend',direction,granularity)}catch{}}
