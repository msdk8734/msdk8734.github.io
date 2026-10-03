/* April 2026 snapshot. Each scene fully describes its own map state. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const svg = $('map-svg');
  const figure = $('sticky-map');
  const cards = [...document.querySelectorAll('.step')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 640px)');
  const cases = {
    4: { id: 'chiyoda', code: '13101', pref: '13', name: 'Chiyoda Ward', region: 'Tokyo', center: [139.754,35.689] },
    5: { id: 'hiezu', code: '31384', pref: '31', name: 'Hiezu Village', region: 'Tottori', center: [133.38,35.441] },
    6: { id: 'taga', code: '25443', pref: '25', name: 'Taga Town', region: 'Shiga', center: [136.284,35.219] },
    7: { id: 'tajiri', code: '27362', pref: '27', name: 'Tajiri Town', region: 'Osaka', center: [135.266,34.410] },
  };
  const cache = new Map();
  let data, japan, prefCounts, mapGroup, prefGroup, muniGroup, pointGroup, labels;
  let width=0, height=0, projection, currentTransform={x:0,y:0,k:1};
  let active=-1, renderVersion=0, animation=0, scrollFrame=0, resizeFrame=0, ready=false;
  let tooltipTrigger=null, metric='total', geography='municipality';
  const kantoCodes=['13','14','12','11'];
  const regionViews={
    3:{id:'kanto',name:'Tokyo and its neighbors',region:'Kanto',center:[139.75,35.8]},
    8:{id:'fukuoka',name:'Fukuoka Prefecture',region:'Kyushu',center:[130.65,33.5]},
  };
  const prefPaths = new Map();
  const fmt = value => value.toLocaleString('en-US');

  function node(tag, attrs={}, parent) {
    const el = document.createElementNS(NS,tag);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
    if(parent) parent.append(el);
    return el;
  }
  function text(parent, value, attrs={}) {
    const el=node('text',attrs,parent);el.textContent=value;return el;
  }
  async function json(url) {
    const response=await fetch(url);
    if(!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
  }
  function loadMunicipalities(pref) {
    if(!cache.has(pref)) {
      const promise=json(`../../geo-json/pref_${pref}.geojson`).catch(error => {cache.delete(pref);throw error;});
      cache.set(pref,promise);
    }
    return cache.get(pref);
  }
  function mercator(lon,lat) {
    return [lon*Math.PI/180,-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
  }
  function area() {
    return mobile.matches
      ? {x:18,y:65,w:width-36,h:height-145}
      : {x:width*.40,y:80,w:width*.57,h:height-205};
  }
  function fit(coords, rect, padding=1) {
    const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const k=Math.min(rect.w/Math.max(maxX-minX,.000001),rect.h/Math.max(maxY-minY,.000001))*padding;
    return {k,x:rect.x+rect.w/2-k*(minX+maxX)/2,y:rect.y+rect.h/2-k*(minY+maxY)/2};
  }
  function project(lon,lat) {
    const [x,y]=mercator(lon,lat);return [projection.x+x*projection.k,projection.y+y*projection.k];
  }
  function coordinates(feature) {
    return feature.geometry.type==='Polygon' ? feature.geometry.coordinates.flat() : feature.geometry.coordinates.flat(2);
  }
  function path(feature) {
    const polygons=feature.geometry.type==='Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    return polygons.map(poly=>poly.map(ring=>ring.map(([lon,lat],i)=>{
      const [x,y]=project(lon,lat);return `${i?'L':'M'}${x.toFixed(3)},${y.toFixed(3)}`;
    }).join('')+'Z').join('')).join('');
  }
  function rate(code) {return prefCounts[code].per100k;}
  // Fixed linear scale; the legend uses the same endpoints and interpolation.
  function rateColor(value,maximum=3.5) {
    const t=Math.max(0,Math.min(1,value/maximum));
    const lo=[236,243,228],hi=[0,98,65];
    return `rgb(${lo.map((v,i)=>Math.round(v+(hi[i]-v)*t)).join(',')})`;
  }
  function closeTooltip(restoreFocus=false) {
    $('map-tooltip').hidden=true;
    if(restoreFocus&&tooltipTrigger?.isConnected)tooltipTrigger.focus({preventScroll:true});
    tooltipTrigger=null;
  }
  function showTooltip(event, heading, description, url) {
    const tip=$('map-tooltip');tip.replaceChildren();
    tooltipTrigger=event.currentTarget;
    const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close map detail');close.onclick=()=>closeTooltip(true);
    const title=document.createElement('strong');title.textContent=heading;
    const body=document.createElement('div');body.textContent=description;
    tip.append(close,title,body);
    if(url){const a=document.createElement('a');a.href=url;a.textContent='Official store page ↗';tip.append(a);}
    tip.hidden=false;
    const rect=figure.getBoundingClientRect();
    const targetRect=event.currentTarget.getBoundingClientRect();
    const x=(event.clientX||targetRect.x+targetRect.width/2)-rect.left;
    const y=(event.clientY||targetRect.y+targetRect.height/2)-rect.top;
    tip.style.left=`${Math.max(mobile.matches?12:width*.40,Math.min(x+14,width-tip.offsetWidth-12))}px`;
    tip.style.top=`${Math.max(56,Math.min(y+12,height-tip.offsetHeight-12))}px`;
    close.focus({preventScroll:true});
  }
  function interactive(el, handler, label) {
    el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label',label);
    el.addEventListener('click',handler);
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();handler(e);}});
  }
  function buildBase() {
    width=figure.clientWidth;height=figure.clientHeight;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.replaceChildren();prefPaths.clear();
    node('title',{id:'map-title'},svg).textContent='Starbucks in Japan, April 2026';
    node('desc',{id:'map-description'},svg).textContent='Read the adjacent chapter for the figures and explanation. Select a store point or a prefecture in the population view for details.';
    svg.setAttribute('role','group');svg.setAttribute('aria-labelledby','map-title map-description');
    const defs=node('defs',{},svg),clip=node('clipPath',{id:'map-window'},defs);
    node('rect',{x:0,y:0,width,height},clip);
    const clipped=node('g',{'clip-path':'url(#map-window)'},svg);
    mapGroup=node('g',{},clipped);
    prefGroup=node('g',{'class':'pref-layer'},mapGroup);
    muniGroup=node('g',{'class':'muni-layer'},mapGroup);
    pointGroup=node('g',{'class':'store-layer'},mapGroup);
    labels=node('g',{'class':'map-labels','pointer-events':'none'},svg);
    // Includes all archived store positions, including the southern islands.
    projection=fit([mercator(122.7,24),mercator(146.2,46)],area(),.98);
    japan.features.forEach(feature=>{
      const el=node('path',{d:path(feature),'fill-rule':'evenodd',fill:'#dce5da',stroke:'#f8f7f4','stroke-width':.8,'vector-effect':'non-scaling-stroke','class':'pref-shape'},prefGroup);
      const code=feature.properties.code;
      prefPaths.set(code,el);
      if(prefCounts[code]) {
        const title=`${prefCounts[code].nameEn}: ${fmt(prefCounts[code].count)} stores; ${rate(code).toFixed(2)} per 100,000 residents`;
        interactive(el,e=>showTooltip(e,prefCounts[code].nameEn,`${fmt(prefCounts[code].count)} stores · ${rate(code).toFixed(2)} per 100,000 residents`),title);
      }
    });
    currentTransform={x:0,y:0,k:1};
  }
  function legend(mode) {
    const el=$('map-legend');
    if(['rate','total','municipal'].includes(mode)) {
      const max=mode==='total'?450:mode==='municipal'?5:3.5;
      const title=mode==='total'?'Total stores':'Stores per 100,000 residents';
      el.innerHTML=`<div class="legend-title">${title}</div><div class="legend-ramp"></div><div class="legend-ticks"><span>0</span><span>${max/2}</span><span>${max}</span></div><div class="legend-note">${mode==='total'?'April 2026 stores':'2025 population'} · linear color scale${mode==='municipal'?'<br>Gray = no resident denominator':''}</div>`;
      el.querySelector('.legend-ramp').style.background=`linear-gradient(90deg,${rateColor(0,max)},${rateColor(max,max)})`;
    } else if(mode==='case') {
      el.innerHTML='<div class="legend-row"><i class="legend-dot"></i><span>Store in the featured municipality</span></div><div class="legend-row"><i class="legend-dot legend-muted"></i><span>Other stores in this prefecture</span></div><div class="legend-row"><i class="legend-boundary"></i><span>Featured municipality</span></div><div class="legend-note">Facility labels mark approximate locations.</div>';
    } else {
      el.innerHTML='<div class="legend-row"><i class="legend-dot"></i><span>One dot = one Starbucks store</span></div><div class="legend-note">April 2026 · dots overlap in dense areas</div>';
    }
  }
  function markPoints(stores, highlightedCode=null) {
    pointGroup.replaceChildren();
    stores.forEach(store=>{
      const [x,y]=project(store.lon,store.lat),selected=highlightedCode===store.muniCode;
      const group=selected?node('g',{'class':'store-point'},pointGroup):pointGroup;
      if(selected)node('circle',{cx:x,cy:y,r:14,fill:'transparent','data-hit':'true','aria-hidden':'true'},group);
      const el=node('circle',{cx:x,cy:y,r:1.7,fill:selected?'#006241':highlightedCode?'#acbba9':'#006241',opacity:highlightedCode&&!selected?.5:.9,'data-selected':selected?'true':'false','class':selected?'store-dot':'national-point','vector-effect':'non-scaling-stroke'},group);
      el.dataset.storeId=store.id;
      if(selected) interactive(group,e=>showTooltip(e,store.name,'Included in the April 2026 snapshot. The official page may show later changes.',store.url),`${store.name}, Starbucks store. Show details.`);
    });
  }
  function locator(entry) {
    const container=$('map-locator');container.hidden=!entry;
    if(!entry)return;
    const mini=$('locator-svg');mini.replaceChildren();mini.setAttribute('viewBox','0 0 82 105');
    const bbox=fit([mercator(122.7,24),mercator(146.2,46)],{x:3,y:3,w:76,h:99});
    const miniProject=([lon,lat])=>{const [x,y]=mercator(lon,lat);return [bbox.x+x*bbox.k,bbox.y+y*bbox.k];};
    japan.features.forEach(feature=>{
      const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
      const d=polygons.map(poly=>poly.map(ring=>ring.map((p,i)=>{const [x,y]=miniProject(p);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`;}).join('')+'Z').join('')).join('');
      node('path',{d,fill:'#ced9cb','fill-rule':'evenodd'},mini);
    });
    const [x,y]=miniProject(entry.center);node('circle',{cx:x,cy:y,r:3.4,fill:'#b5672b',stroke:'#fff','stroke-width':1.3},mini);
    mini.setAttribute('aria-label',`${entry.name}, ${entry.region}, highlighted on a map of Japan`);
  }
  function paintLabels(entry,transform) {
    labels.replaceChildren();
    if(!entry) {
      if(active===9) {
        Object.values(cases).forEach(item=>{
          const [x,y]=project(...item.center);
          node('circle',{cx:x,cy:y,r:5,fill:'#b5672b',stroke:'#f8f7f4','stroke-width':2},labels);
          const offsets=item.id==='tajiri'?[-8,20]:item.id==='hiezu'?[-10,-14]:item.id==='taga'?[14,30]:[10,-8];
          node('path',{d:`M${x},${y}L${x+offsets[0]},${y+offsets[1]-4}`,fill:'none',stroke:'#b5672b','stroke-width':.8},labels);
          text(labels,item.name,{x:x+offsets[0],y:y+offsets[1],'text-anchor':offsets[0]<0?'end':'start','class':'map-label'});
        });
      }
      return;
    }
    if(entry.id==='kanto'||entry.id==='fukuoka') {
      const annotations=entry.id==='kanto'
        ? [ ['Tokyo · 3.09',139.55,35.7,-35,13],['Saitama · 1.33',139.5,36.05,0,-14],['Chiba · 1.54',140.3,35.5,20,18],['Kanagawa · 1.56',139.25,35.35,-20,28] ]
        : [ ['Fukuoka City · '+(geography==='prefecture'?'1.79':'3.23'),130.4,33.59,-12,24],['Kitakyushu City · '+(geography==='prefecture'?'1.79':'1.42'),130.85,33.88,12,-14] ];
      annotations.forEach(([name,lon,lat,dx,dy])=>{
        const base=project(lon,lat),x=transform.x+base[0]*transform.k,y=transform.y+base[1]*transform.k;
        const tx=Math.max(area().x+55,Math.min(width-65,x+dx));
        node('path',{d:`M${x},${y}L${tx},${y+dy}`,stroke:'#526953','stroke-width':1,fill:'none'},labels);
        text(labels,name,{x:tx,y:y+dy,'text-anchor':'middle','class':'map-label'});
      });
      return;
    }
    const places=data.landmarks.filter(item=>item.caseId===entry.id);
    places.forEach(place=>{
      const base=project(place.lon,place.lat),x=transform.x+base[0]*transform.k,y=transform.y+base[1]*transform.k;
      const anchorRight=entry.id==='taga'?false:x>area().x+area().w*.60;
      const labelX=Math.min(width-20,Math.max(area().x+10,x+(anchorRight?-22:22)));
      const labelY=Math.max(86,y+(entry.id==='taga'&&place.id==='taga-upbound'?32:-30));
      node('path',{d:`M${x},${y-7}L${x},${labelY+5}L${labelX},${labelY+5}`,fill:'none',stroke:'#a65e28','stroke-width':1.2},labels);
      text(labels,place.name,{x:labelX,y:labelY,'text-anchor':anchorRight?'end':'start','class':'map-label facility-label'});
    });
    // Tajiri consists of mainland and airport parts; label both to explain the boundary.
    if(entry.id==='tajiri') {
      const p=project(135.292,34.392),x=transform.x+p[0]*transform.k,y=transform.y+p[1]*transform.k;
      if(x>area().x&&x<width-12&&y>80&&y<height-80)text(labels,'Tajiri · mainland',{x,y,'text-anchor':'middle','class':'map-label'});
    }
  }
  function applyTransform(transform,entry) {
    currentTransform=transform;
    mapGroup.setAttribute('transform',`translate(${transform.x},${transform.y}) scale(${transform.k})`);
    pointGroup.querySelectorAll('circle').forEach(el=>{
      if(el.dataset.hit){el.setAttribute('r',14/transform.k);return;}
      const selected=el.dataset.selected==='true';
      el.setAttribute('r',(entry?(selected?(mobile.matches?4.6:5):2):mobile.matches?1.35:1.65)/transform.k);
      if(selected){el.setAttribute('stroke','#fff');el.setAttribute('stroke-width',1.2);}
    });
    paintLabels(entry,transform);
  }
  function moveTo(target,entry,animate=true) {
    cancelAnimationFrame(animation);
    const start={...currentTransform};
    if(!animate||reducedMotion.matches){applyTransform(target,entry);svg.setAttribute('aria-busy','false');return;}
    const began=performance.now(),duration=520;
    function frame(now){
      const t=Math.min(1,(now-began)/duration),ease=1-Math.pow(1-t,3);
      applyTransform({x:start.x+(target.x-start.x)*ease,y:start.y+(target.y-start.y)*ease,k:start.k+(target.k-start.k)*ease},entry);
      if(t<1)animation=requestAnimationFrame(frame);else svg.setAttribute('aria-busy','false');
    }
    animation=requestAnimationFrame(frame);
  }
  function updateNavigation(step) {
    cards.forEach((card,index)=>card.querySelector('.step-card').classList.toggle('is-active',index===step));
    document.querySelectorAll('[data-chapter]').forEach(link=>{
      if(Number(link.dataset.chapter)===step) {
        link.setAttribute('aria-current','step');
        const nav=link.parentElement,linkRect=link.getBoundingClientRect(),navRect=nav.getBoundingClientRect();
        if(linkRect.right>navRect.right)nav.scrollLeft+=linkRect.right-navRect.right;
        if(linkRect.left<navRect.left)nav.scrollLeft-=navRect.left-linkRect.left;
      } else link.removeAttribute('aria-current');
    });
    $('chapter-progress').textContent=`${String(step+1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;
  }
  function rank(code,key) {
    const value=prefCounts[code][key];
    return 1+Object.values(prefCounts).filter(row=>row[key]>value).length;
  }
  function updateMetric(value) {
    metric=value;
    const key=value==='total'?'count':'per100k',maximum=value==='total'?450:3.5;
    prefPaths.forEach((el,code)=>el.setAttribute('fill',rateColor(prefCounts[code][key],maximum)));
    legend(value);
    svg.dataset.metric=value;
    $('map-caption').textContent=value==='total'?'Total stores by prefecture':'The same stores, divided by residents';
    $('map-status').textContent='Same April snapshot · select a prefecture for details';
    document.querySelectorAll('[data-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.metric===value)));
    document.querySelectorAll('[data-ranking]').forEach(panel=>{
      panel.dataset.ranking=value;
      panel.innerHTML=`<div class="rank-heading"><span>Prefecture</span><span>${value==='total'?'Stores':'Per 100k'}</span><span>Rank / 47</span></div>`;
      ['13','47','11','01'].forEach(code=>{
        const row=prefCounts[code];
        const item=document.createElement('div');
        [row.nameEn.replace(/ (Prefecture|Metropolis)$/,''),value==='total'?fmt(row.count):row.per100k.toFixed(2),`#${rank(code,key)}`].forEach((v,i)=>{const cell=document.createElement(i===1?'strong':'span');cell.textContent=v;item.append(cell);});
        panel.append(item);
      });
    });
  }
  function updateGeography(value) {
    geography=value;svg.dataset.geography=value;
    const regional=value==='prefecture';
    muniGroup.querySelectorAll('[data-city-code]').forEach(el=>{
      const row=data.statistics.municipalities[el.dataset.cityCode];
      el.setAttribute('fill',regional?rateColor(rate('40'),5):row?.population?rateColor(row.per100k,5):'#d1d3cf');
      el.setAttribute('stroke',regional?rateColor(rate('40'),5):'#f8f7f4');
      if(row)el.setAttribute('aria-label',regional?'Fukuoka Prefecture: 1.79 stores per 100,000 residents':`${row.nameEn}: ${row.per100k.toFixed(2)} stores per 100,000 residents`);
    });
    document.querySelectorAll('[data-geography]').forEach(button=>{
      if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.geography===value));
    });
    $('map-caption').textContent=regional?'Fukuoka Prefecture · one average':'Fukuoka Prefecture · municipal differences';
    $('map-status').textContent=regional?'1.79 stores per 100,000 residents across the prefecture':'Same 0–5 scale · designated-city wards share the city rate';
    paintLabels(regionViews[8],currentTransform);
  }
  async function render(step,animate=true) {
    if(!ready)return;
    active=step;const version=++renderVersion;
    cancelAnimationFrame(animation);closeTooltip();updateNavigation(step);
    svg.dataset.scene=String(step);
    svg.setAttribute('aria-busy','true');
    muniGroup.replaceChildren();labels.replaceChildren();
    document.querySelectorAll('button[data-geography]').forEach(button=>{button.disabled=true;});
    const entry=cases[step],region=regionViews[step],isMetric=step===1||step===2;
    if(isMetric)metric=step===1?'total':'rate';
    const isRate=step===3||isMetric&&metric==='rate';
    prefGroup.setAttribute('aria-hidden',String(!(isMetric||step===3)));
    prefPaths.forEach((el,code)=>{
      el.setAttribute('fill',isRate?rateColor(rate(code)):isMetric?rateColor(prefCounts[code].count,450):'#dce5da');
      el.setAttribute('opacity',entry?'.65':step===3&&!kantoCodes.includes(code)?'.22':'1');
      el.setAttribute('tabindex',isMetric||step===3&&kantoCodes.includes(code)?'0':'-1');
      el.style.pointerEvents=isMetric||step===3&&kantoCodes.includes(code)?'auto':'none';
    });
    legend(entry?'case':isRate?'rate':isMetric?'total':step===8?'municipal':'points');locator(entry||region);
    $('map-caption').textContent=entry?`${entry.name} · ${entry.region}`:region?region.name:step===9?'Four places. Four reasons to look beyond residents.':'2,108 stores across Japan';
    $('map-status').textContent=entry?'Loading local boundaries…':region?'Stores per 100,000 residents · April 2026 snapshot':'Each point is an archived store location, April 2026.';
    if(isMetric)updateMetric(metric);
    if(region) {
      pointGroup.style.display='none';
      if(step===3) {
        const coords=japan.features.filter(f=>kantoCodes.includes(f.properties.code)).flatMap(coordinates).filter(([lon,lat])=>lon<141&&lat>34.85);
        moveTo(fit(coords.map(p=>project(...p)),area(),.76),region,animate);
      } else {
        geography='municipality';
        $('map-status').textContent='Loading municipal boundaries…';
        try {
          const geo=await loadMunicipalities('40');
          if(version!==renderVersion||active!==step)return;
          const rows=Object.values(data.statistics.municipalities).filter(row=>row.prefCode==='40');
          const byCode=new Map();
          rows.forEach(row=>(row.aggregatedWardCodes||[row.code]).forEach(code=>byCode.set(code,row)));
          geo.features.forEach(f=>{
            const row=byCode.get(f.properties.code);
            const el=node('path',{d:path(f),'fill-rule':'evenodd',fill:rateColor(rate('40'),5),stroke:'#f8f7f4','stroke-width':.7,'vector-effect':'non-scaling-stroke','class':'municipal-shape','data-muni-code':f.properties.code,'data-city-code':row?.code||''},muniGroup);
            if(row)interactive(el,e=>{
              const shown=geography==='prefecture'?prefCounts['40']:row;
              showTooltip(e,geography==='prefecture'?'Fukuoka Prefecture':row.nameEn,`${fmt(shown.count)} stores · ${fmt(shown.population)} residents · ${shown.per100k.toFixed(2)} per 100,000`);
            },`${row.nameEn}: ${row.per100k.toFixed(2)} stores per 100,000 residents`);
          });
          document.querySelectorAll('button[data-geography]').forEach(button=>{button.disabled=false;});
          const coords=geo.features.flatMap(coordinates).map(p=>project(...p));
          updateGeography('prefecture');
          moveTo(fit(coords,area(),.78),region,animate);
          // Reveal local variation after the camera arrives; stale scenes cannot repaint.
          const reveal=()=>{if(version===renderVersion&&active===8)updateGeography('municipality');};
          if(animate&&!reducedMotion.matches)setTimeout(reveal,550);else reveal();
        } catch(error) {
          if(version!==renderVersion)return;
          console.error(error);
          const feature=japan.features.find(f=>f.properties.code==='40');
          prefPaths.get('40').setAttribute('fill',rateColor(rate('40'),5));
          moveTo(fit(coordinates(feature).map(p=>project(...p)),area(),.78),region,false);
          $('map-status').textContent='Municipal boundaries unavailable. The prefecture average is shown; city figures remain in the text.';
        }
      }
      return;
    }
    if(!entry) {
      pointGroup.style.display=isMetric?'none':'';
      if(!isMetric)markPoints(data.stores);
      moveTo({x:0,y:0,k:1},null,animate);
      return;
    }
    pointGroup.style.display='';
    const localStores=data.stores.filter(store=>store.prefCode===entry.pref);
    markPoints(localStores,entry.code);
    try {
      const geo=await loadMunicipalities(entry.pref);
      if(version!==renderVersion||active!==step)return;
      const feature=geo.features.find(f=>f.properties.code===entry.code);
      if(!feature)throw new Error('Municipal boundary missing');
      [...geo.features].sort((a,b)=>Number(a.properties.code===entry.code)-Number(b.properties.code===entry.code)).forEach(f=>node('path',{d:path(f),'fill-rule':'evenodd',fill:f.properties.code===entry.code?'#e6eee2':'#e1e8de',stroke:f.properties.code===entry.code?'#006241':'#becdba','stroke-width':f.properties.code===entry.code?1.5:.6,'vector-effect':'non-scaling-stroke','data-muni-code':f.properties.code},muniGroup));
      const selected=data.stores.filter(store=>store.muniCode===entry.code);
      const points=coordinates(feature).concat(selected.map(store=>[store.lon,store.lat])).map(p=>project(...p));
      const transform=fit(points,area(),.77);
      $('map-status').textContent=`${selected.length} ${selected.length===1?'store':'stores'} in the featured municipality · select a green dot for details`;
      moveTo(transform,entry,animate);
    } catch(error) {
      if(version!==renderVersion)return;
      console.error(error);
      const points=data.stores.filter(s=>s.muniCode===entry.code).map(s=>project(s.lon,s.lat));
      // Keep the story readable even if one local boundary request fails.
      const center=project(...entry.center),rect=area(),k=25;
      moveTo({k,x:rect.x+rect.w/2-center[0]*k,y:rect.y+rect.h/2-center[1]*k},entry,false);
      $('map-status').textContent='Local boundaries unavailable. Store points are shown; figures remain in the text.';
      if(!points.length)pointGroup.replaceChildren();
    }
  }
  function determineStep() {
    const navHeight=document.querySelector('.story-nav').getBoundingClientRect().height;
    const threshold=mobile.matches?navHeight+figure.clientHeight+(innerHeight-navHeight-figure.clientHeight)*.34:innerHeight*.52;
    let next=0;
    cards.forEach((card,index)=>{if(card.getBoundingClientRect().top<=threshold)next=index;});
    return next;
  }
  function onScroll() {
    if(scrollFrame)return;
    scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;const next=determineStep();if(next!==active)render(next);});
  }
  function resize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(!ready||width===figure.clientWidth&&height===figure.clientHeight)return;
      cancelAnimationFrame(animation);++renderVersion;buildBase();render(determineStep(),false);
    });
  }
  function hydrateNumbers() {
    const {count:total,population}=data.statistics.national;
    const stats={'national-count':fmt(total),'national-rate':(total/population*100000).toFixed(2)};
    Object.values(cases).forEach(entry=>{
      const row=data.statistics.municipalities[entry.code];
      stats[`${entry.id}-rate`]=row.per100k.toFixed(1);
      stats[`${entry.id}-count`]=`${row.count} ${row.count===1?'store':'stores'}`;
      stats[`${entry.id}-population`]=`${fmt(row.population)} residents`;
    });
    document.querySelectorAll('[data-stat]').forEach(el=>{if(stats[el.dataset.stat]!==undefined)el.textContent=stats[el.dataset.stat];});
  }
  async function init() {
    try {
      [data,japan]=await Promise.all([json('./story-data.json?v=20261004b'),json('../../geo-json/japan-simple.geojson')]);
      prefCounts=data.statistics.prefectures;
      hydrateNumbers();buildBase();ready=true;
      window.addEventListener('scroll',onScroll,{passive:true});
      new ResizeObserver(resize).observe(figure);
      reducedMotion.addEventListener('change',()=>render(active,false));
      await render(determineStep(),false);
      // Cache the local datasets. Rejected requests can be retried on entry.
      Promise.allSettled([...Object.values(cases).map(entry=>entry.pref),'40'].map(loadMunicipalities));
    }catch(error){
      console.error(error);$('map-caption').textContent='The map could not load.';
      $('map-status').textContent='The article, rankings and comparison below remain available. Reload to retry the map.';
      $('map-legend').textContent='April 2026 snapshot · 2,108 stores';
    }
  }
  document.querySelectorAll('button[data-metric]').forEach(button=>button.addEventListener('click',()=>{
    if(active===1||active===2)updateMetric(button.dataset.metric);
  }));
  document.querySelectorAll('button[data-geography]').forEach(button=>button.addEventListener('click',()=>{
    if(active===8){++renderVersion;updateGeography(button.dataset.geography);}
  }));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeTooltip(true);});
  // All reading and chapter navigation also work without JavaScript.
  init();
})();
