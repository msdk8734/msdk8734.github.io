// Exercise the actual map's scale and geographic aggregation with the bundled data.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'starbucks-store-map.html'),'utf8');
const extra=fs.readFileSync(path.join(root,'starbucks-map-explorer.js'),'utf8');
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
function fn(src,name){const start=src.indexOf(`function ${name}(`);assert(start>=0);let end=src.indexOf('\nfunction ',start+1);if(end<0)end=src.indexOf('\nasync function ',start+1);return src.slice(start,end<0?undefined:end);}
function element(){return {attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v;},addEventListener(){},appendChild(v){this.children.push(v);},remove(){}};}
const context={C_LO:[239,248,242],C_HI:[0,98,65],METRIC_PER100K:'per100k',NATIONAL_MODE_CITY:'city',currentMetric:'per100k',currentNationalMode:'city',scaleMode:'local',cityLayerG:null,muniGeoCache:{'40':json('geo-json/pref_40.geojson')},muniMetaCache:{'40':json('population-json/municipalities/muni-pop-40.json')},municipalityData:json('data/starbucks-municipality-counts.json'),prefDataMap:json('data/starbucks-store-counts.json').prefectures,nationalMunicipalityData:json('data/starbucks-national-municipality-ranking.json'),document:{createElementNS:element,getElementById:element},moveTip:()=>{},featureToPath:()=>'',setLegend:(min,max)=>{context.legend=[min,max];}};
context.getNationalItems=()=>context.nationalMunicipalityData.modes[context.currentNationalMode];
vm.createContext(context);
for(const name of ['metricLegendLabel','getColor','getMetricValue','calcMetricRange','compareMetricDesc','assignCompetitionRanks','buildWardToCityMap','drawPrefectureMunicipalities'])vm.runInContext(fn(html,name),context);
vm.runInContext(fn(extra,'colorRange'),context);
assert.equal(context.getColor(5,0,10),'rgb(120,173,154)','midpoint must match the linear legend');
context.drawPrefectureMunicipalities('40');
let paths=context.cityLayerG.children.filter(e=>e.attrs['data-rankkey']==='40130');
assert.equal(paths.length,7);
assert.equal(new Set(paths.map(e=>e.attrs.fill)).size,1,'all Fukuoka wards must use the city fill in City Mode');
assert(Math.abs(context.currentRankItems.find(r=>r.code==='40130').per100k-3.233549)<1e-5);
assert(Math.abs(context.legend[1]-4.104838)<1e-5);
context.currentNationalMode='ward';context.drawPrefectureMunicipalities('40');
assert(Math.abs(context.legend[1]-8.937793)<1e-5,'ward legend must include the largest ward value');
assert.equal(context.currentRankItems[0].code,'40133');
assert.notEqual(context.cityLayerG.children.find(e=>e.attrs['data-code']==='40133').attrs.fill,context.cityLayerG.children.find(e=>e.attrs['data-code']==='40132').attrs.fill);
context.scaleMode='national';context.drawPrefectureMunicipalities('40');
assert.equal(context.legend[1],Math.max(...context.getNationalItems().map(r=>r.per100k||0)));
console.log('Passed: linear legend, city aggregation, ward ranking, unclipped local range, national fixed scale.');
