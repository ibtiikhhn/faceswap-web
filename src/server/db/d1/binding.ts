import {remoteD1,type D1Transport,type D1Statement} from './client';
class Statement {
 constructor(readonly transport:D1Transport,readonly sql:string,readonly params:unknown[]=[]){}
 bind(...params:unknown[]){return new Statement(this.transport,this.sql,params);}
 async all(){return (await this.transport([{sql:this.sql,params:this.params}]))[0];}
 async run(){return this.all();}
 async first(column?:string){const row=(await this.all()).results[0];return column ? row?.[column]??null : row??null;}
 async raw(){return (await this.transport([{sql:this.sql,params:this.params,raw:true}]))[0].raw!;}
}
export function d1Binding(database:'app'|'cms',transport:D1Transport=remoteD1(database)) {
 return {
  prepare:(sql:string)=>new Statement(transport,sql),
  batch:(statements:D1Statement[])=>transport(statements.map(s=>({sql:s.sql,params:s.params}))),
  exec:async(sql:string)=>{await transport([{sql,params:[]}]);return {count:1,duration:0};},
 };
}
