import {editorApi} from './config.js?v=review-1';
const $=id=>document.getElementById(id);
const styles={milestone:'First milestone','personal-best':'Personal best',count:'Completion count',perfect:'Perfect clear',challenge:'Challenge clear',endurance:'Endurance',favorite:'Favorite achievement'};
let context, base, draft, bannerDraft=null, objectUrl='', busy=false;
const section=document.createElement('section');section.className='singlepanel customization';
section.innerHTML=`<h2>Profile Highlights</h2><p>Badges are personal highlights. Apply a badge to a placement, a game list, or your entire profile.</p><div id="badge-editor"></div><button type="button" id="add-badge">Add badge</button><h3>Game list button banner</h3><p>The image appears behind this game’s list button on your profile.</p><p id="banner-list-name"></p><label>Upload button banner <input id="banner-file" type="file" accept="image/png,image/jpeg,image/webp"></label><label>Banner opacity <input id="banner-opacity" type="range" min="5" max="50" value="15"><output id="banner-percentage">15%</output></label><label><input type="checkbox" id="banner-tint"> Blend With Primary (Right) Profile Color</label><div class="game-banner list-tab-banner-preview" id="banner-preview" hidden><span class="list-tab-banner" id="banner-art"><img id="banner-image" alt=""></span><h2 id="banner-title"></h2></div><button type="button" id="remove-banner">Remove banner</button><p id="custom-status" role="status"></p><button type="button" id="reset-custom">Discard customization</button><button type="button" id="save-custom" disabled>Save customization</button><dialog id="custom-dialog"><form id="custom-form"><h2>Save customization</h2><p id="custom-save-status" role="status"></p><label>Player ID (16 digits)<input id="custom-code" type="password" inputmode="numeric" pattern="[0-9]{16}" maxlength="16" required autocomplete="off"></label><button type="submit">Confirm and save</button><button type="button" id="cancel-custom">Cancel</button></form></dialog>`;
$('levels').before(section);
const framingSection = document.createElement('div');
framingSection.id = 'background-framing';
framingSection.innerHTML = `<h3>Frame your uploaded background</h3><label>Preview size <select id="frame-device"><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select></label><div id="frame-controls"></div><div id="frame-preview"><div id="frame-image"></div><strong>Profile preview</strong><p>Your lists and placements</p></div><button type="button" id="save-framing" disabled>Save Framing</button>`;
$('background-status').before(framingSection);
$('save-framing').onclick = () => $('save-custom').click();
for(const [key,label,min,max,value] of [['x','Horizontal position',0,100,50],['y','Vertical position',0,100,50],['zoom','Zoom',100,200,100]]){
 const l=document.createElement('label');l.textContent=label;const i=document.createElement('input');i.type='range';i.id='frame-'+key;i.min=min;i.max=max;i.value=value;const o=document.createElement('output');o.id='frame-'+key+'-value';l.append(i,o);$('frame-controls').append(l);
 i.addEventListener('input',()=>{draft.framing[$('frame-device').value][key]=Number(i.value);refresh();});
}
const defaults=()=>({desktop:{x:50,y:50,zoom:100},mobile:{x:50,y:50,zoom:100}});
const snapshot=p=>JSON.stringify({framing:p.backgroundFraming||defaults(),badges:p.badges||[],banners:p.lists.map(e=>({id:e.id,image:e.bannerImage,version:e.bannerVersion,opacity:e.bannerOpacity||15,tint:e.bannerTint===true}))});
const changed=()=>context&&(JSON.stringify(draft)!==base.draft||bannerDraft);
async function api(path,options){const r=await fetch(editorApi+path,options);const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not save customization.');return data;}
function init(detail){
 if(context?.player===detail.player && changed()){ $('custom-status').textContent='Save or discard customization before switching its banner to another list.';return; }
 context=detail;base={snapshot:snapshot(detail.profile)};draft={framing:structuredClone(detail.profile.backgroundFraming||defaults()),badges:structuredClone(detail.profile.badges||[]),banner:{list:detail.list,opacity:detail.profile.lists.find(e=>e.id===detail.list)?.bannerOpacity||15,tint:detail.profile.lists.find(e=>e.id===detail.list)?.bannerTint===true}};base.draft=JSON.stringify(draft);bannerDraft=null;
 if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';renderBadges();refresh();
}
function renderBadges(){
 $('badge-editor').replaceChildren();draft.badges.forEach((badge,index)=>{
 const row=document.createElement('div');row.className='badge-fields';
 const type=document.createElement('select');type.setAttribute('aria-label','Badge style');for(const [value,label]of Object.entries(styles))type.add(new Option(label,value));type.value=badge.style;
 const name=document.createElement('input');name.setAttribute('aria-label','Badge display name');name.maxLength=60;name.placeholder='Badge display name';name.value=badge.name;
 const list=document.createElement('select');list.setAttribute('aria-label','Badge game list');list.add(new Option('Entire profile',''));context.profile.lists.forEach(e=>list.add(new Option(e.title,e.id)));list.value=badge.list||'';
 const level = document.createElement('select');
 level.setAttribute('aria-label', 'Badge placement');
 const populateLevels = async () => {
   const listId = list.value;
   level.replaceChildren(new Option(listId ? 'Entire Game List' : 'Choose a Game List First', ''));
   level.disabled = true;
   if (!listId) return;
   if (badge.level) level.add(new Option('Saved Placement', badge.level, true, true));
   try {
     const { document } = await api('/list?' + new URLSearchParams({player: context.player, list: listId}));
     if (list.value !== listId || !level.isConnected) return;
     level.replaceChildren(new Option('Entire Game List', ''));
     for (const item of document.levels) {
       const key = item.videoUrl ? 'video:' + item.videoUrl : 'name:' + item.name;
       if (![...level.options].some(option => option.value === key)) level.add(new Option(item.name, key));
     }
     if (badge.level && ![...level.options].some(option => option.value === badge.level)) {
       level.add(new Option('Saved Placement (Unavailable)', badge.level));
     }
     level.value = badge.level || '';
     level.disabled = false;
   } catch {
     if (list.value !== listId || !level.isConnected) return;
     level.options[0].textContent = 'Could Not Load Placements';
   }
 };
 level.onchange = () => {badge.level = level.value; refresh();};
 const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove badge '+(badge.name||index+1));remove.onclick=()=>{draft.badges.splice(index,1);renderBadges();refresh();};
 type.onchange=()=>{badge.style=type.value;refresh();};name.oninput=()=>{badge.name=name.value;refresh();};list.onchange=()=>{badge.list=list.value;delete badge.level;populateLevels();refresh();};row.append(type,level,name,list,remove);$('badge-editor').append(row);populateLevels();
 });$('add-badge').disabled=draft.badges.length>=12;
}
function refresh(){if(!context)return;
 $('background-framing').hidden = !window.PlayerListsTheme.imageUrl(context.profile,'../');
 const device=$('frame-device').value,frame=draft.framing[device];for(const key of ['x','y','zoom']){$('frame-'+key).value=frame[key];$('frame-'+key+'-value').textContent=frame[key]+'%';}
 $('frame-preview').classList.toggle('mobile-preview',device==='mobile');
 const source=window.PlayerListsTheme.imageUrl(context.profile,'../');$('frame-preview').hidden=!source;$('frame-controls').hidden=!source;
 const image=$('frame-image');window.PlayerListsTheme.applyImageMask(image,source,document.body.classList.contains('light-mode')?context.profile.backgroundInvertLight!==true:context.profile.backgroundInvertDark===true);window.PlayerListsTheme.applyFrame(image,frame);image.style.opacity=(context.profile.backgroundOpacity||15)/100;
 const entry=context.profile.lists.find(e=>e.id===draft.banner.list);$('banner-list-name').textContent='Banner for '+entry.title;$('banner-title').textContent=entry.title;
 const artwork = { 'geometry-dash':'geometry-dash', celeste:'celeste', 'beat-saber':'beat-saber', 'fnaf-challenges':'fnaf', fnaf:'fnaf' }[entry.game || entry.id];
 const uploaded = bannerDraft ? !bannerDraft.remove : Boolean(entry.bannerImage);
 const banner = uploaded
   ? (bannerDraft ? objectUrl : '../players/'+context.player+'/'+entry.bannerImage+'?v='+entry.bannerVersion)
   : (artwork ? '../assets/game-art/' + artwork + '.webp' : '');
 $('banner-preview').hidden=!banner;if(banner)$('banner-image').src=banner;else $('banner-image').removeAttribute('src');$('banner-art').style.opacity=uploaded ? draft.banner.opacity/100 : .65;$('banner-art').classList.toggle('banner-accent',draft.banner.tint);$('banner-tint').checked=draft.banner.tint;$('banner-opacity').value=draft.banner.opacity;$('banner-percentage').textContent=draft.banner.opacity+'%';
 $('remove-banner').disabled=!uploaded||busy;$('save-framing').disabled=busy||JSON.stringify(draft.framing)===JSON.stringify(JSON.parse(base.draft).framing);$('save-custom').disabled=!changed()||busy;$('reset-custom').disabled=!changed()||busy;
}
$('frame-device').onchange=refresh;
$('add-badge').onclick=()=>{if(draft.badges.length<12){draft.badges.push({style:'milestone',name:'',list:context.list});renderBadges();refresh();}};
$('banner-tint').onchange=()=>{draft.banner.tint=$('banner-tint').checked;refresh();};
$('banner-opacity').oninput=()=>{draft.banner.opacity=Number($('banner-opacity').value);refresh();};
$('banner-file').onchange=async()=>{const file=$('banner-file').files[0];if(!file)return;busy=true;refresh();try{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10485760)throw new Error('Choose a PNG, JPG, or WebP up to 10 MB.');
 const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>25000000){bitmap.close();throw new Error('Choose an image under 25 megapixels.');}
 const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 let blob;for(const quality of [.82,.65,.45]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob?.size<=1048576)break;}if(!blob||blob.size>1048576)throw new Error('Choose a smaller image.');
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
 if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(blob);bannerDraft={image:data.split(',')[1]};$('custom-status').textContent='Banner preview ready. Save with your Player ID.';
 }catch(error){$('custom-status').textContent=error.message;}finally{busy=false;refresh();}};
$('remove-banner').onclick=()=>{bannerDraft={remove:true};refresh();};
$('reset-custom').onclick=()=>{bannerDraft=null;draft=JSON.parse(base.draft);renderBadges();refresh();};
$('save-custom').onclick=()=>{if(draft.badges.some(b=>!b.name.trim())){$('custom-status').textContent='Give each badge a display name.';return;}$('custom-save-status').textContent='Enter this profile’s Player ID to publish your customization.';$('custom-dialog').showModal();};
$('cancel-custom').onclick=()=>{if(!busy)$('custom-dialog').close();};$('custom-dialog').addEventListener('close',()=>{$('custom-code').value='';});$('custom-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
$('custom-form').onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;event.submitter.disabled=true;$('custom-save-status').textContent='Saving customization…';try{
 const latest=await api('/appearance?player='+context.player);if(snapshot(latest.document)!==base.snapshot)throw new Error('Customization changed elsewhere. Reload before saving.');
 const result=await api('/customization?player='+context.player,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('custom-code').value,revision:latest.revision,framing:draft.framing,badges:draft.badges,banner:{...draft.banner,...bannerDraft}})});
 if(!result.unchanged&&result.reviewState!=='merged')throw new Error('Customization could not merge. Your draft is still open.');
 bannerDraft=null;base.draft=JSON.stringify(draft);context.profile=result.document;base.snapshot=snapshot(result.document);$('custom-status').textContent='Customization saved. The public profile updates after deployment.';$('custom-dialog').close();
 }catch(error){$('custom-save-status').textContent=error.message;}finally{busy=false;event.submitter.disabled=false;$('custom-code').value='';refresh();}};
window.addEventListener('player-editor-ready',e=>init(e.detail));window.addEventListener('beforeunload',e=>{if(changed()||busy)e.preventDefault();});
new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['class']});


