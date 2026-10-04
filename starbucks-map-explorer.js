/* Discovery, consistent scales and shareable state for the April 2026 map. */
let scaleMode='national', selectedPlace=null, comparison=[], navigationVersion=0, resizeTimer;
let focusedCity=null;
let explorerReady=false, restoringView=false, sheetInitialized=false;
const byId=id=>document.getElementById(id);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function colorRange(items,municipal) {
  let rows=scaleMode==='national'?(municipal?getNationalItems():Object.values(prefDataMap)):items;
  if(municipal && scaleMode==='local' && currentNationalMode==='ward' && focusedCity) {
    const wards=items.filter(r=>getNationalItems().find(w=>w.code===r.code)?.parentCode===focusedCity.code);
    if(wards.length)rows=wards;
  }
  return {min:0,max:Math.max(1,...rows.map(getMetricValue))};
}
function nationalRank(item,key) {
  const rows=item.code.length===2?Object.values(prefDataMap):getNationalItems();
  return rows.some(r=>r.code===item.code)?1+rows.filter(r=>(r[key]||0)>(item[key]||0)).length:null;
}
function canonical(code) {
  return code?.length===2?prefDataMap[code]:getNationalItems().find(r=>r.code===code);
}
function placeMarkup(item) {
  const totalRank=nationalRank(item,'count'),rateRank=nationalRank(item,'per100k');
  return `<h3>${escapeHTML(item.nameEn)}</h3><p>${escapeHTML(item.nameJa)}</p><dl><div><dt>Stores</dt><dd>${formatCount(item.count)}</dd></div><div><dt>Residents · 2025</dt><dd>${formatPopulation(item.population)}</dd></div><div><dt>Per 100,000</dt><dd>${item.population>0?item.per100k.toFixed(2):'No data'}</dd></div></dl><p class="rank-change">National rank: <strong>#${totalRank??'—'} → #${rateRank??'—'}</strong><br>total stores → per 100k · ${item.code.length===2?'47 prefectures':currentNationalMode==='city'?'City Mode':'Ward Mode'}</p>`;
}
function selectedMarkup(item) {
  const total=nationalRank(item,'count'),rate=nationalRank(item,'per100k');
  const added=comparison.some(r=>r.code===item.code);
  return `<header class="detail-heading"><div><h3>${escapeHTML(item.nameEn)}</h3><p>${escapeHTML(item.nameJa)}${item.prefNameEn?' · '+escapeHTML(item.prefNameEn):''}</p></div><button type="button" data-close-detail aria-label="Close selected place">×</button></header>
    <dl class="detail-metrics"><div><dt>Stores</dt><dd>${formatCount(item.count)}</dd></div><div><dt>Per 100k</dt><dd>${item.population?item.per100k.toFixed(2):'—'}</dd></div><div><dt>Residents · 2025</dt><dd>${formatPopulation(item.population)}</dd></div></dl>
    <footer class="detail-footer"><p><span>National rank</span><strong>#${total??'—'} <span aria-label="to">→</span> #${rate??'—'}</strong><small>Stores → per 100k</small></p><button type="button" id="add-comparison" ${added||comparison.length>=3?'disabled':''}>${added?'Added ✓':'+ Compare'}</button></footer>`;
}
// City focus persists independently of the selected ward and its detail card.
function focusCityForPlace(item) {
  focusedCity=currentNationalMode==='ward' && item?.parentCode
    ? {code:item.parentCode,name:item.parentNameEn,prefCode:item.prefCode}:null;
}
function clearPlaceSelection() {
  selectedPlace=null;
  currentNationalSelection=null;
  clearMunicipalityHighlight();
  hideTip();updateExplorer();
}
function updateWardContext() {
  const paths=[...document.querySelectorAll('.city-path')];
  const parent=currentNationalMode==='ward' && focusedCity?.prefCode===zoomedPrefCode ? focusedCity.code : '';
  const range=colorRange(currentRankItems,true);
  paths.forEach(el=>{
    const sameCity=!!parent && el.dataset.parentCity===parent;
    el.classList.toggle('ward-city-context',sameCity);
    el.classList.toggle('outside-ward-city',!!parent && !sameCity);
    if(sameCity)el.classList.remove('dimmed');
    const row=currentRankItems.find(r=>r.code===el.dataset.rankkey);
    if(row){el.setAttribute('fill',getColor(getMetricValue(row),range.min,range.max));delete el.dataset.origFill;}
  });
  if(paths.length){
    setLegend(range.min,range.max,metricLegendLabel('municipality'));
    if(parent && scaleMode==='local')byId('scale-note').textContent=`Within ${focusedCity.name} · linear · wards separate`;
  }
}
function updateExplorer() {
  if(!explorerReady)return;
  const panel=byId('place-detail');panel.hidden=!selectedPlace;
  document.querySelectorAll('.city-path,.pref-path').forEach(el=>el.classList.toggle('selected-place',(el.dataset.rankkey||el.dataset.code)===selectedPlace?.code));
  updateWardContext();
  document.body.classList.toggle('has-selection',!!selectedPlace);
  if(selectedPlace){hideTip();panel.innerHTML=selectedMarkup(selectedPlace);}
  byId('compare-open').textContent=`Compare (${comparison.length}/3)`;
  byId('compare-content').innerHTML=comparison.length?comparison.map(item=>`<article>${placeMarkup(item)}<button type="button" data-remove="${item.code}">Remove ${escapeHTML(item.nameEn)}</button></article>`).join(''):'<p>Search for a place or select it on the map, then choose “Add to comparison”.</p>';
  if(!restoringView)saveView();
}
function saveView() {
  const q=new URLSearchParams();q.set('metric',currentMetric);q.set('mode',currentNationalMode);q.set('scale',scaleMode);q.set('panel',currentPanelMode);
  if(zoomedPrefCode)q.set('pref',zoomedPrefCode);
  if(selectedPlace)q.set('place',selectedPlace.code);
  if(focusedCity && currentNationalMode==='ward')q.set('city',focusedCity.code);
  if(comparison.length)q.set('compare',comparison.map(r=>r.code).join(','));
  history.replaceState(null,'',`${location.pathname}?${q}${location.hash}`);
}
async function selectPlace(item,navigate=true) {
  if(!item)return;
  focusCityForPlace(item);selectedPlace=item;updateExplorer();
  if(bsMobile)bsSetState('peek');
  if(navigate) {
    if(item.code.length===2)await zoomInPrefecture(item.code);
    else await focusNationalItem(item);
  }
  hideTip();updateExplorer();
}
function searchPlaces() {
  const term=byId('place-search').value.trim().toLocaleLowerCase();
  const out=byId('search-results');out.replaceChildren();out.hidden=!term;
  if(!term)return;
  const rows=[...Object.values(prefDataMap),...getNationalItems()];
  const matches=rows.filter(r=>`${r.nameEn} ${r.nameJa} ${r.displayNameJa||''}`.toLocaleLowerCase().includes(term)).slice(0,15);
  if(!matches.length){out.textContent='No matching places / 該当なし';return;}
  matches.forEach(item=>{
    const button=document.createElement('button');button.type='button';button.textContent=`${item.nameEn} / ${item.nameJa}${item.prefNameEn?' · '+item.prefNameEn:''}`;
    button.onclick=async()=>{out.hidden=true;byId('place-search').value=item.nameEn;await selectPlace(item);};out.append(button);
  });
}
function refitMap() {
  if(!explorerReady)return;
  svgW=innerWidth;svgH=innerHeight;PANEL_W=innerWidth>720&&!IS_TOUCH?250:0;
  const needsSheet=innerWidth<=720||IS_TOUCH;
  if(needsSheet&&!sheetInitialized){bsInit();sheetInitialized=true;}
  bsMobile=needsSheet;bsEl.style.display=needsSheet?'flex':'none';
  if(bsMobile)bsSetState('peek',false);
  svgEl.setAttribute('width',svgW);svgEl.setAttribute('height',svgH);
  fitProjection(Object.values(prefFeatMap),svgW,svgH,20,byId('header').offsetHeight+20,20+PANEL_W,bsMobile?120:40);
  document.querySelectorAll('.pref-path').forEach(el=>el.setAttribute('d',featureToPath(prefFeatMap[el.dataset.code])));
  const pref=zoomedPrefCode;zoomedPrefCode=null;
  if(cityLayerG){cityLayerG.remove();cityLayerG=null;}
  viewX=0;viewY=0;viewScale=1;applyView();
  if(pref)zoomInPrefecture(pref);else{renderOverviewRanking();renderCurrentPanel();}
}
async function restoreView() {
  restoringView=true;
  const q=new URLSearchParams(location.search);
  currentMetric=q.get('metric')==='per100k'?'per100k':'total';
  currentNationalMode=q.get('mode')==='ward'?'ward':'city';
  scaleMode=q.get('scale')==='local'?'local':'national';
  currentPanelMode=q.get('panel')==='national'?'national':'overview';
  byId('scale-mode').value=scaleMode;
  comparison=(q.get('compare')||'').split(',').map(canonical).filter(Boolean).filter((v,i,a)=>a.findIndex(r=>r.code===v.code)===i).slice(0,3);
  applyMetricToggleUI();renderOverviewRanking();renderCurrentPanel();
  const item=canonical(q.get('place'));
  if(item){focusCityForPlace(item);selectedPlace=item;updateExplorer();}
  const city=nationalMunicipalityData.modes.city.find(r=>r.code===q.get('city'));
  if(currentNationalMode==='ward' && city)focusedCity={code:city.code,name:city.nameEn,prefCode:city.prefCode};
  const pref=q.get('pref');
  if(prefDataMap[pref]){await zoomInPrefecture(pref);if(item?.prefCode===pref)applyNationalSelection(item);}
  hideTip();
  restoringView=false;updateExplorer();
}
async function initExplorer() {
  explorerReady=true;sheetInitialized=bsMobile;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(refitMap,150);});
  byId('data-notes').addEventListener('toggle',refitMap);
  svgEl.setAttribute('role','group');svgEl.setAttribute('aria-label','Starbucks counts by region. Select a region for details.');
  byId('place-search').addEventListener('input',searchPlaces);
  byId('place-search').addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();byId('search-results').querySelector('button')?.focus();}});
  byId('scale-mode').onchange=()=>{scaleMode=byId('scale-mode').value;if(zoomedPrefCode&&muniGeoCache[zoomedPrefCode])drawPrefectureMunicipalities(zoomedPrefCode);else renderOverviewRanking();renderCurrentPanel();};
  byId('compare-open').onclick=()=>{updateExplorer();byId('compare-dialog').showModal();};
  byId('compare-close').onclick=()=>byId('compare-dialog').close();
  byId('compare-dialog').addEventListener('click',e=>{const code=e.target.closest('[data-remove]')?.dataset.remove;if(code){comparison=comparison.filter(r=>r.code!==code);updateExplorer();byId('compare-close').focus();}});
  byId('place-detail').addEventListener('click',e=>{
    if(e.target.closest('[data-close-detail]')){clearPlaceSelection();byId('place-search').focus();return;}
    if(e.target.id==='add-comparison'&&selectedPlace&&comparison.length<3&&!comparison.some(r=>r.code===selectedPlace.code))comparison.push({...selectedPlace});
    updateExplorer();if(e.target.id==='add-comparison')byId('compare-open').focus();
  });
  byId('share-view').onclick=async()=>{saveView();try{await navigator.clipboard.writeText(location.href);byId('explorer-status').textContent='View link copied';}catch{byId('explorer-status').textContent='Copy the URL from your address bar to share this view.';}};
  const handle=byId('bs-handle-area');handle.setAttribute('role','button');handle.tabIndex=0;handle.setAttribute('aria-label','Expand or collapse rankings');
  const hint=document.createElement('span');hint.textContent='Rankings ↕';hint.className='sheet-label';handle.append(hint);
  handle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();bsSetState(bsState==='peek'?'half':'peek');}});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){byId('search-results').hidden=true;hideTip();if(!byId('compare-dialog').open){clearPlaceSelection();}}
    const el=e.target.closest('.rk-item,.pref-path,.city-path');
    if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();el.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
  });
  document.addEventListener('click',e=>{
    const el=e.target.closest('.city-path');
    if(el && !didDrag && selectedPlace?.code===(el.dataset.rankkey||el.dataset.code)){
      e.preventDefault();e.stopImmediatePropagation();clearPlaceSelection();
    }
  },true);
  document.addEventListener('click',e=>{
    const el=e.target.closest('.rk-item,.pref-path,.city-path');if(!el||didDrag)return;
    const code=el.dataset.rankkey||el.dataset.code;
    const item=canonical(code);if(item){focusCityForPlace(item);selectedPlace=item;hideTip();updateExplorer();if(bsMobile)bsSetState('peek');}
  });
  document.addEventListener('focusin',e=>{const el=e.target.closest('.pref-path,.city-path');if(el)el.setAttribute('aria-label',`${canonical(el.dataset.rankkey||el.dataset.code)?.nameEn||'Region'}, select for details`);});
  await restoreView();
}
