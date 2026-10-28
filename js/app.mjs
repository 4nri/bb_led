import {newProject,makeBlock,uid,layout,sectionStats,divisors,LIMITS,xml} from './model.mjs';
import {wheelScale} from './zoom.mjs';
import {loadAssets,sectionMarkup,svgDocument} from './geometry.mjs';
import {saveProject,readSavedProject,prepareFonts,importProject,uploadFont,download} from './project.mjs';

const $=id=>document.getElementById(id);
let project=newProject(),assets=null,selectedId=project.blocks[1].id;
const view={zoom:'fit',mode:'seams',grid:false,ruler:false};
const invalid=new Set();
let saveTimer,toastTimer,resizeFrame,previousPositions=new Map(),isReady=false;
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const selected=()=>project.blocks.find(b=>b.id===selectedId);
const format=value=>Math.round(value).toLocaleString('ru-RU');
const setValue=(id,value)=>{const input=$(id);if(input.value!==String(value))input.value=value;};

function toast(message) {
    clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;
    toastTimer=setTimeout(()=>$('toast').hidden=true,4000);
}
function persist() {
    clearTimeout(saveTimer);$('saveState').textContent='Сохраняем…';
    saveTimer=setTimeout(()=>{$('saveState').textContent=saveProject(project)?'Сохранено локально':'Скачайте проект';if($('saveState').textContent==='Скачайте проект')toast('В браузере не хватило места. Сохраните проект файлом.');},300);
}
function commit(change,{inspector=true}={}) {
    change();renderAll({inspector});persist();
}
function numeric(id,min,max,apply,getValue) {
    const input=$(id);
    input.addEventListener('input',()=>{
        const value=input.valueAsNumber;
        const valid=Number.isInteger(value)&&value>=min&&value<=max;
        input.setAttribute('aria-invalid',String(!valid));
        input.closest('.number-unit')?.classList.toggle('invalid',!valid);
        if(!valid){invalid.add(id);$('exportButton').disabled=true;return;}
        invalid.delete(id);commit(()=>apply(value));
    });
    input.addEventListener('blur',()=>{
        if(!invalid.has(id))return;
        invalid.delete(id);input.value=getValue();input.setAttribute('aria-invalid','false');
        input.closest('.number-unit')?.classList.remove('invalid');
        $('exportButton').disabled=!isReady||invalid.size>0;
        toast('Сохранено предыдущее значение. Размеры должны быть целыми числами в допустимом диапазоне.');
    });
}
function showPanel(panel,{animate=true}={}) {
    const board=panel==='board';
    $('boardPanel').hidden=!board;$('blockPanel').hidden=board;
    $('boardTab').setAttribute('aria-selected',String(board));$('blockTab').setAttribute('aria-selected',String(!board));
    if(animate&&!reducedMotion())(board?$('boardPanel'):$('blockPanel')).animate([{opacity:.35,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
}
function selectBlock(id) {
    if(!project.blocks.some(b=>b.id===id))return;
    selectedId=id;renderLayers();renderInspector();renderSelection();renderMobilePreview();showPanel('block');
}
function addBlock(type) {
    if(project.blocks.length>=LIMITS.blocks)return toast('В проекте может быть не больше 100 блоков.');
    commit(()=>{const block=makeBlock(type);project.blocks.push(block);selectedId=block.id;},{inspector:true});
    showPanel('block');
}
function renderBoard() {
    setValue('projectTitle',project.title);setValue('totalLength',project.totalLength);setValue('boardHeight',project.boardHeight);
    setValue('sectionLength',project.sectionLength);setValue('bgColor',project.bgColor);$('bgHex').textContent=project.bgColor.slice(1).toUpperCase();
    const {count,remainder,covered}=sectionStats(project);
    const counts=divisors(project.totalLength).filter(n=>n<=10000);
    $('sectionCount').innerHTML=(remainder?`<option value="">${count} полных + остаток</option>`:'')+counts.map(n=>`<option value="${n}">${n} секц.</option>`).join('');
    $('sectionCount').value=remainder?'':String(count);$('sectionCountBadge').textContent=`× ${count}`;
    $('sectionStats').textContent=`${count} × ${format(project.sectionLength)} = ${format(covered)} px`;
    $('remainderNote').hidden=!remainder;
    $('remainderNote').textContent=`Остаток ${format(remainder)} px. В полном SVG он заполняется началом следующей секции.`;
    const {contentWidth}=layout(project,assets.fonts);
    const values=divisors(project.totalLength).filter(n=>n>=Math.max(1,Math.ceil(contentWidth)));
    const candidates=values.sort((a,b)=>Math.abs(a-project.sectionLength)-Math.abs(b-project.sectionLength)).slice(0,8).sort((a,b)=>a-b);
    $('divisors').innerHTML=candidates.length?candidates.map(n=>`<button data-section-length="${n}" aria-pressed="${n===project.sectionLength}">${format(n)}</button>`).join(''):'<p class="meta">Увеличьте длину борта или уменьшите содержимое.</p>';
}
function renderLayers() {
    $('blockCount').textContent=String(project.blocks.length).padStart(2,'0');
    $('layerList').innerHTML=project.blocks.map((b,i)=>`<button class="layer-row" data-layer-id="${b.id}" aria-pressed="${b.id===selectedId}" aria-label="${xml(b.type==='logo'?'Логотип BETBOOM':b.text||'Пустой текст')}" title="${xml(b.type==='logo'?'Логотип BETBOOM':b.text||'Пустой текст')}"><span class="layer-symbol" aria-hidden="true">${b.type==='logo'?'◈':'T'}</span><span class="layer-name">${xml(b.type==='logo'?'Логотип':b.text||'Пустой текст')}</span><span class="layer-index">${String(i+1).padStart(2,'0')}</span></button>`).join('');
    $('addText').disabled=project.blocks.length>=LIMITS.blocks;$('addLogo').disabled=$('addText').disabled;
}
function renderInspector() {
    const block=selected();
    $('emptyInspector').hidden=!!block;$('inspectorBody').hidden=!block;$('inspectorIndex').textContent=block?String(project.blocks.indexOf(block)+1).padStart(2,'0'):'00';
    if(!block)return;
    const logo=block.type==='logo';
    $('inspectorTitle').textContent=logo?'Логотип BETBOOM':'Текстовый блок';
    $('inspectorSubtitle').textContent=logo?'Векторный знак · 500 : 118':block.fontKey==='ony'?'ONY Track Compressed Black':project.fonts[block.fontKey]?.name;
    $('textField').hidden=logo;$('fontField').hidden=logo;
    setValue('blockText',block.text);setValue('blockSize',block.fontSize);setValue('blockOffset',block.verticalOffset);setValue('blockColor',block.color);
    $('blockSizeLabel').textContent=logo?'Высота логотипа':'Кегль';$('blockHex').textContent=block.color.slice(1).toUpperCase();
    $('cropNote').textContent=logo?'Пропорции знака сохраняются при изменении высоты.':'Кадрирование по высоте сохраняется.';
    $('blockFont').innerHTML='<option value="ony">ONY Track Compressed Black</option>'+Object.entries(project.fonts).map(([key,f])=>`<option value="${key}">${xml(f.name)}</option>`).join('');
    $('blockFont').value=block.fontKey;
    $('moveBack').disabled=project.blocks.indexOf(block)===0;$('moveForward').disabled=project.blocks.indexOf(block)===project.blocks.length-1;
}
function scaleValue() {
    const sourceWidth=project.sectionLength*(view.mode==='seams'?3:1);
    return view.zoom==='fit'?Math.min(2,Math.max(1,$('sceneViewport').clientWidth-64)/sourceWidth):Number(view.zoom);
}
function renderRuler(width,scale) {
    $('ruler').toggleAttribute('hidden',!view.ruler);
    if(!view.ruler)return;
    const step=Math.pow(10,Math.floor(Math.log10(80/scale)));
    const tick=step*(step*scale<40?5:1);
    let marks='';
    for(let value=0;value<=width;value+=tick){const x=value*scale;marks+=`<line x1="${x}" x2="${x}" y1="18" y2="25" stroke="currentColor" opacity=".4"/><text x="${x+3}" y="12" fill="currentColor" font-size="9" font-family="monospace">${value}</text>`;}
    $('ruler').setAttribute('width',width*scale);$('ruler').innerHTML=marks;
}
function renderScene({geometry=true}={}) {
    if(!assets)return;
    const repeats=view.mode==='seams'?3:1,sourceWidth=project.sectionLength*repeats,scale=scaleValue();
    const width=sourceWidth*scale,height=project.boardHeight*scale;
    $('preview').setAttribute('viewBox',`0 0 ${sourceWidth} ${project.boardHeight}`);
    $('preview').setAttribute('width',sourceWidth);$('preview').setAttribute('height',project.boardHeight);
    $('preview').style.width=`${width}px`;$('preview').style.height=`${height}px`;
    if(geometry) {
        const contents=sectionMarkup(project,assets,{interactive:true});
        const artwork=Array.from({length:repeats},(_,i)=>`<svg x="${i*project.sectionLength}" width="${project.sectionLength}" height="${project.boardHeight}" viewBox="0 0 ${project.sectionLength} ${project.boardHeight}" overflow="hidden">${contents}</svg>`).join('');
        $('preview').innerHTML=`<rect width="${sourceWidth}" height="${project.boardHeight}" fill="${project.bgColor}"/>${artwork}`;
        const positions=new Map(layout(project,assets.fonts).blocks.map(b=>[b.id,b.x]));
        if(!reducedMotion())for(const el of $('preview').querySelectorAll('[data-block-id]')) {
            const id=el.dataset.blockId,old=previousPositions.get(id),next=positions.get(id);
            if(old!==undefined&&old!==next)el.animate([{transform:`translate(${old}px,0)`},{transform:`translate(${next}px,0)`}],{duration:200,easing:'cubic-bezier(.2,.8,.2,1)'});
        }
        previousPositions=positions;
    }
    $('frame').style.width=`${width}px`;$('frame').style.height=`${height}px`;
    $('sceneCanvas').style.width=`${Math.max($('sceneViewport').clientWidth,width+64)}px`;
    $('sceneCanvas').style.justifyContent=width+64>$('sceneViewport').clientWidth?'start':'center';
    $('sceneCanvas').style.minHeight=`${Math.max($('sceneViewport').clientHeight,height+(view.ruler?170:130))}px`;
    $('artboardTitle').textContent=view.mode==='seams'?'ТРИ СЕКЦИИ · ПРОВЕРКА СТЫКОВ':'ОДНА СЕКЦИЯ';
    $('artboardSize').textContent=`${format(project.sectionLength)} × ${format(project.boardHeight)} px`;
    $('dimensionLabel').textContent=`${format(sourceWidth)} px`;
    $('seamMarkers').innerHTML=repeats===3?[1,2].map(i=>`<i style="left:${i*project.sectionLength*scale}px"></i>`).join(''):'';
    $('sceneViewport').classList.toggle('grid-on',view.grid);
    $('zoomReadout').textContent=`Масштаб ${Math.round(scale*1000)/10}%${view.zoom==='fit'?' · вписано':''}`;
    document.querySelectorAll('[data-zoom]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zoom===view.zoom)));
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view.mode)));
    $('gridToggle').setAttribute('aria-pressed',String(view.grid));$('rulerToggle').setAttribute('aria-pressed',String(view.ruler));
    renderRuler(sourceWidth,scale);renderSelection();renderMobilePreview();
}
function renderSelection() {
    const block=layout(project,assets.fonts).blocks.find(b=>b.id===selectedId);
    $('selectionBox').hidden=!block||!block.width;
    if(!block)return;
    const scale=scaleValue(),width=Math.min(block.width,Math.max(0,project.sectionLength-block.x));
    Object.assign($('selectionBox').style,{left:`${block.x*scale}px`,top:'0px',width:`${width*scale}px`,height:`${project.boardHeight*scale}px`});
    for(const el of $('preview').querySelectorAll('[data-block-id]'))el.setAttribute('aria-pressed',String(el.dataset.blockId===selectedId));
}
function renderMobilePreview() {
    const block=layout(project,assets.fonts).blocks.find(b=>b.id===selectedId);
    const x=block?Math.max(0,block.x-40):0;
    const width=block?Math.max(1,Math.min(project.sectionLength-x,block.width+80)):project.sectionLength;
    $('mobileArtwork').setAttribute('viewBox',`${x} 0 ${width} ${project.boardHeight}`);
    $('mobileArtwork').innerHTML=`<rect width="${project.sectionLength}" height="${project.boardHeight}" fill="${project.bgColor}"/>${sectionMarkup(project,assets)}`;
    $('mobilePreviewLabel').textContent=block?(block.type==='logo'?'ЛОГОТИП':'ВЫБРАННЫЙ ТЕКСТ'):'СЕКЦИЯ';
}
function renderMetrics() {
    const data=layout(project,assets.fonts),overflow=data.overflow>0;
    $('layoutNotice').classList.toggle('warning',overflow);
    $('layoutMessage').textContent=overflow?`Не хватает ${format(data.overflow)} px по ширине. Увеличьте секцию или уменьшите кегль.`:project.blocks.length?'Содержимое помещается в секцию':'Пустая секция. В экспорте останется фон.';
    $('spaceMetric').textContent=overflow?'':`${format(data.free)} px свободно`;
    $('exportSectionSize').textContent=`${format(project.sectionLength)} × ${format(project.boardHeight)} px`;
    $('exportBoardSize').textContent=`${format(project.totalLength)} × ${format(project.boardHeight)} px`;
    const {count,remainder}=sectionStats(project);
    $('exportTailNote').hidden=!remainder;$('exportTailNote').textContent=`Полных секций: ${count}. Остаток ${format(remainder)} px будет заполнен началом следующей секции.`;
    $('exportWarning').hidden=!overflow;$('exportWarning').textContent=`Блоки выходят за ширину секции на ${format(data.overflow)} px. В SVG они будут обрезаны по её границам.`;
    $('exportButton').disabled=!isReady||invalid.size>0;
    $('exportBoard').disabled=count+(remainder?1:0)>10000;
}
function renderAll({inspector=true}={}) {
    renderBoard();renderLayers();if(inspector)renderInspector();renderScene();renderMetrics();
}
function bindEvents() {
    numeric('totalLength',1,LIMITS.length,v=>project.totalLength=v,()=>project.totalLength);
    numeric('boardHeight',1,LIMITS.height,v=>project.boardHeight=v,()=>project.boardHeight);
    numeric('sectionLength',1,LIMITS.length,v=>project.sectionLength=v,()=>project.sectionLength);
    $('sectionCount').addEventListener('change',()=>{const count=Number($('sectionCount').value);if(count>0)commit(()=>project.sectionLength=project.totalLength/count);});
    numeric('blockSize',1,LIMITS.height,v=>{if(selected())selected().fontSize=v;},()=>selected()?.fontSize||138);
    numeric('blockOffset',-LIMITS.height,LIMITS.height,v=>{if(selected())selected().verticalOffset=v;},()=>selected()?.verticalOffset||0);
    $('projectTitle').addEventListener('input',()=>commit(()=>project.title=$('projectTitle').value));
    $('bgColor').addEventListener('input',()=>commit(()=>project.bgColor=$('bgColor').value));
    $('blockColor').addEventListener('input',()=>commit(()=>{if(selected())selected().color=$('blockColor').value;}));
    $('blockText').addEventListener('input',()=>commit(()=>{if(selected())selected().text=$('blockText').value;},{inspector:false}));
    $('blockFont').addEventListener('change',()=>commit(()=>{if(selected())selected().fontKey=$('blockFont').value;}));
    $('addText').addEventListener('click',()=>addBlock('text'));$('addLogo').addEventListener('click',()=>addBlock('logo'));
    $('layerList').addEventListener('click',e=>{const button=e.target.closest('[data-layer-id]');if(button)selectBlock(button.dataset.layerId);});
    $('preview').addEventListener('click',e=>{const block=e.target.closest('[data-block-id]');if(block)selectBlock(block.dataset.blockId);});
    $('preview').addEventListener('keydown',e=>{const block=e.target.closest('[data-block-id]');if(block&&['Enter',' '].includes(e.key)){e.preventDefault();selectBlock(block.dataset.blockId);}});
    $('duplicateBlock').addEventListener('click',()=>{
        if(!selected()||project.blocks.length>=LIMITS.blocks)return;
        commit(()=>{const index=project.blocks.indexOf(selected());const copy={...selected(),id:uid()};project.blocks.splice(index+1,0,copy);selectedId=copy.id;});
    });
    $('removeBlock').addEventListener('click',()=>commit(()=>{const index=project.blocks.findIndex(b=>b.id===selectedId);if(index<0)return;project.blocks.splice(index,1);selectedId=project.blocks[Math.min(index,project.blocks.length-1)]?.id||null;}));
    for(const [id,delta] of [['moveBack',-1],['moveForward',1]])$(id).addEventListener('click',()=>commit(()=>{const index=project.blocks.findIndex(b=>b.id===selectedId),next=index+delta;if(index<0||next<0||next>=project.blocks.length)return;[project.blocks[index],project.blocks[next]]=[project.blocks[next],project.blocks[index]];}));
    $('divisors').addEventListener('click',e=>{const button=e.target.closest('[data-section-length]');if(button)commit(()=>project.sectionLength=Number(button.dataset.sectionLength));});
    document.querySelectorAll('[data-panel]').forEach(button=>button.addEventListener('click',()=>showPanel(button.dataset.panel)));
    document.querySelector('.inspector-tabs').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const next=$('boardTab').getAttribute('aria-selected')==='true'?'block':'board';showPanel(next);$(next==='board'?'boardTab':'blockTab').focus();}});
    document.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>setZoom(button.dataset.zoom)));
    document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{view.mode=button.dataset.view;renderScene();$('sceneViewport').scrollTo({left:0});}));
    $('gridToggle').addEventListener('click',()=>{view.grid=!view.grid;renderScene({geometry:false});});$('rulerToggle').addEventListener('click',()=>{view.ruler=!view.ruler;renderScene({geometry:false});});
    $('exportButton').addEventListener('click',()=>{renderMetrics();$('exportDialog').showModal();});
    for(const [id,kind] of [['exportSection','section'],['exportBoard','board']])$(id).addEventListener('click',()=>{
        try{const width=kind==='board'?project.totalLength:project.sectionLength;download(svgDocument(project,assets,kind),`betboom-led-${kind}-${width}x${project.boardHeight}.svg`,'image/svg+xml');$('exportDialog').close();toast(kind==='board'?'SVG всего борта скачан.':'SVG секции скачан.');}catch(error){toast(error.message);}
    });
    $('exportDialog').addEventListener('click',e=>{if(e.target===$('exportDialog')){const r=$('exportDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('exportDialog').close();}});
    $('saveButton').addEventListener('click',()=>{download(JSON.stringify(project,null,2),'betboom-led-project.json','application/json');toast('Проект сохранён вместе с пользовательскими шрифтами.');});
    $('importButton').addEventListener('click',()=>$('projectFile').click());
    $('projectFile').addEventListener('change',async()=>{
        const file=$('projectFile').files[0];if(!file)return;
        try{project=await importProject(file,assets);selectedId=project.blocks[1]?.id||project.blocks[0]?.id;invalid.clear();renderAll();persist();toast('Проект открыт.');}catch(error){toast(`Не удалось открыть проект. ${error.message}`);}finally{$('projectFile').value='';}
    });
    $('uploadFont').addEventListener('click',()=>$('fontFile').click());
    $('fontFile').addEventListener('change',async()=>{
        const file=$('fontFile').files[0],blockId=selectedId;if(!file)return;
        try{const font=await uploadFont(file,assets);commit(()=>{const block=project.blocks.find(b=>b.id===blockId);if(!block)return;project.fonts[font.key]=font.value;block.fontKey=font.key;});toast('Шрифт загружен и сохранён в проекте.');}catch(error){toast(`Не удалось загрузить шрифт. ${error.message}`);}finally{$('fontFile').value='';}
    });
    $('backToScene').addEventListener('click',()=>window.scrollTo({top:Math.max(0,scrollY+document.querySelector('.workspace').getBoundingClientRect().top-12),behavior:reducedMotion()?'auto':'smooth'}));
    const mobileVisibility=()=>{$('mobilePreview').hidden=!matchMedia('(max-width: 850px)').matches||document.querySelector('.workspace').getBoundingClientRect().bottom>100;};
    document.addEventListener('scroll',mobileVisibility,{passive:true});window.addEventListener('resize',mobileVisibility);
    bindCanvasNavigation();
    new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>renderScene({geometry:false}));}).observe($('sceneViewport'));
}
function setZoom(zoom) {view.zoom=zoom;renderScene({geometry:false});$('sceneViewport').scrollTo({left:0});}
function bindCanvasNavigation() {
    let space=false,drag=null,wheelTimer;
    const viewport=$('sceneViewport');
    viewport.addEventListener('wheel',event=>{
        if(!event.deltaY||!assets)return;
        event.preventDefault();
        const oldFrame=$('frame').getBoundingClientRect();
        const scale=oldFrame.width/(project.sectionLength*(view.mode==='seams'?3:1))||scaleValue();
        const next=wheelScale(scale,event.deltaY,event.deltaMode,viewport.clientHeight);
        if(next===scale)return;
        const sourceX=(event.clientX-oldFrame.left)/scale;
        const sourceY=(event.clientY-oldFrame.top)/scale;
        viewport.classList.add('wheel-zooming');
        clearTimeout(wheelTimer);
        view.zoom=String(next);
        renderScene({geometry:false});
        const newFrame=$('frame').getBoundingClientRect();
        viewport.scrollLeft+=newFrame.left+sourceX*next-event.clientX;
        viewport.scrollTop+=newFrame.top+sourceY*next-event.clientY;
        wheelTimer=setTimeout(()=>viewport.classList.remove('wheel-zooming'),140);
    },{passive:false});
    document.addEventListener('keydown',e=>{
        if(e.target.closest('input,textarea,select,dialog'))return;
        if(e.code==='Space'){space=true;$('sceneViewport').classList.add('pan-ready');if(e.target===document.body)e.preventDefault();}
        if(e.ctrlKey||e.metaKey||e.altKey)return;
        if(e.key.toLowerCase()==='f'){e.preventDefault();setZoom('fit');}
        if(e.key==='1'){e.preventDefault();setZoom('1');}if(e.key==='2'){e.preventDefault();setZoom('2');}
    });
    document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;$('sceneViewport').classList.remove('pan-ready');}});
    window.addEventListener('blur',()=>{space=false;drag=null;$('sceneViewport').classList.remove('pan-ready','is-panning');});
    $('sceneViewport').addEventListener('pointerdown',e=>{if(!space&&e.button!==1)return;e.preventDefault();drag={x:e.clientX,y:e.clientY,left:$('sceneViewport').scrollLeft,top:$('sceneViewport').scrollTop};$('sceneViewport').setPointerCapture(e.pointerId);$('sceneViewport').classList.add('is-panning');});
    $('sceneViewport').addEventListener('pointermove',e=>{
        const r=$('frame').getBoundingClientRect(),scale=scaleValue();$('cursorX').textContent=Math.max(0,Math.round((e.clientX-r.left)/scale));$('cursorY').textContent=Math.round((e.clientY-r.top)/scale);
        if(drag){$('sceneViewport').scrollLeft=drag.left+drag.x-e.clientX;$('sceneViewport').scrollTop=drag.top+drag.y-e.clientY;}
    });
    const end=()=>{drag=null;$('sceneViewport').classList.remove('is-panning');};$('sceneViewport').addEventListener('pointerup',end);$('sceneViewport').addEventListener('pointercancel',end);
}
async function init() {
    try {
        assets=await loadAssets();
        try{const saved=readSavedProject();if(saved){const fonts=await prepareFonts(saved,assets);for(const [key,font]of fonts)assets.fonts.set(key,font);project=saved;}}catch{toast('Сохранённый проект не прочитан. Открыт исходный макет; старые данные в браузере сохранены.');}
        selectedId=project.blocks.find(b=>b.type==='text')?.id||project.blocks[0]?.id;
        isReady=true;bindEvents();renderAll();$('saveState').textContent='Сохранено локально';
    } catch(error) {$('assetError').hidden=false;$('assetError').textContent=error.message;$('saveState').textContent='Ошибка загрузки';$('exportButton').disabled=true;}
}
init();
