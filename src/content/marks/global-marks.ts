import {sendRpc} from '../../shared/rpc'; export const getMarks=()=>sendRpc('marks.get'); export const setMark=(key:string,record:unknown)=>sendRpc('marks.set',{key,record});
