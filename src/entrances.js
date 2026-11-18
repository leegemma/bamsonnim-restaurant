export const staffEntrance=s=>({x:0,y:s.size-1});
export const zombieEntrance=s=>s.zombieEntrance||{x:Math.min(6,s.size-2),y:0};
export const atEntrance=(s,x,y)=>[staffEntrance(s),zombieEntrance(s)].some(p=>p.x===x&&p.y===y);
export const zombieExit=s=>{const p=zombieEntrance(s);return[p.x,p.y];};
export const customerExit=(s,c)=>c?.exitDoor?[c.exitDoor.x,c.exitDoor.y]:zombieExit(s);
