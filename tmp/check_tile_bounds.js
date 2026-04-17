function tileBoundsMeters(x,y,z){ const tile2 = 2**z; const lonLeft = (x/tile2)*360-180; const lonRight = ((x+1)/tile2)*360-180; const nTop = Math.PI - 2*Math.PI*y/tile2; const nBottom = Math.PI - 2*Math.PI*(y+1)/tile2; const latTop = (180/Math.PI)*(Math.atan(0.5*(Math.exp(nTop)-Math.exp(-nTop)))) ; const latBottom = (180/Math.PI)*(Math.atan(0.5*(Math.exp(nBottom)-Math.exp(-nBottom)))) ; const R=6378137; const lon2m = (lon)=> lon*R*Math.PI/180; const lat2m = (lat)=> Math.log(Math.tan((90+lat)*Math.PI/360)) * R; return [lon2m(lonLeft), lat2m(latBottom), lon2m(lonRight), lat2m(latTop)]; }
const bounds=[-8905559.263453785,-2272843.234911632,-5009548.539015882,1118889.974857895];
console.log('dataset bounds m:',bounds);
const lon=-62.50077009564654; const lat=-5.176014574781698;
for(const z of [5,6,7,8]){
  const x = Math.floor((( lon + 180)/360)*(2**z));
  const tileCount=2**z; const latRad=(lat*Math.PI)/180; const y=Math.floor(((1-Math.log(Math.tan(latRad)+1/Math.cos(latRad))/Math.PI)/2)*tileCount);
  const b=tileBoundsMeters(x,y,z);
  console.log('z',z,'x',x,'y',y,'tile bounds m:',b);
  const inter = !(b[2] < bounds[0] || b[0] > bounds[2] || b[3] < bounds[1] || b[1] > bounds[3]);
  console.log('intersects dataset?',inter);
}
