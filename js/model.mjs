export const STORAGE_KEY = 'betboom-led-project-v2';
export const LIMITS = { length:1000000, height:4096, blocks:100, fontBytes:5*1024*1024 };
export const uid = () => crypto.randomUUID();
export function makeBlock(type='text') {
    return {id:uid(),type,text:type==='text'?'ТЕКСТ':'',fontSize:type==='logo'?96:138,color:'#ffffff',verticalOffset:type==='logo'?0:5,fontKey:'ony'};
}
export function newProject() {
    const logo=makeBlock('logo'),text=makeBlock(); text.text='ФРИБЕТ ДО 10 000';
    return {version:2,title:'Фрибет · LED-борт',totalLength:24960,boardHeight:96,sectionLength:2496,bgColor:'#1a1a1a',blocks:[logo,text],fonts:{}};
}
export function divisors(number) {
    const result=[];
    for(let i=1;i<=Math.sqrt(number);i++) if(number%i===0) {result.push(i);if(i!==number/i)result.push(number/i);}
    return result.sort((a,b)=>a-b);
}
export function sectionStats(project) {
    const count=Math.floor(project.totalLength/project.sectionLength);
    return {count,remainder:project.totalLength%project.sectionLength,covered:count*project.sectionLength};
}
export function validateProject(value) {
    const fail=message=>{throw new Error(message);};
    if(!value||value.version!==2||!Array.isArray(value.blocks)||value.blocks.length>LIMITS.blocks) fail('Формат проекта не поддерживается.');
    const number=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
    if(!number(value.totalLength,1,LIMITS.length)||!number(value.sectionLength,1,LIMITS.length)||!number(value.boardHeight,1,LIMITS.height)) fail('Проверьте размеры борта и секции.');
    if(typeof value.title!=='string'||value.title.length>120)fail('Название проекта должно содержать до 120 символов.');
    const hex=s=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s);
    if(!hex(value.bgColor))fail('Неверный цвет фона.');
    const fonts={};
    if(value.fonts!==undefined&&(!value.fonts||typeof value.fonts!=='object'||Array.isArray(value.fonts)))fail('Не удалось прочитать шрифты проекта.');
    for(const [key,font] of Object.entries(value.fonts||{})) {
        if(!/^custom-[a-z0-9-]+$/i.test(key)||!font||typeof font.name!=='string'||font.name.length>150||typeof font.data!=='string'||font.data.length>LIMITS.fontBytes*1.4||!/^[A-Za-z0-9+/]*={0,2}$/.test(font.data)) fail('Не удалось прочитать шрифты проекта.');
        fonts[key]={name:font.name,data:font.data};
    }
    const ids=new Set();
    const blocks=value.blocks.map(b=>{
        if(!b||!['logo','text'].includes(b.type)||typeof b.id!=='string'||!/^[a-z0-9-]+$/i.test(b.id)||ids.has(b.id))fail('Не удалось прочитать блоки проекта.');
        ids.add(b.id);
        if(!number(b.fontSize,1,LIMITS.height)||!number(b.verticalOffset,-LIMITS.height,LIMITS.height)||!hex(b.color)||typeof b.text!=='string'||b.text.length>2000)fail('Проверьте параметры блоков.');
        if(b.fontKey!=='ony'&&!Object.hasOwn(fonts,b.fontKey))fail('В проекте отсутствует шрифт текстового блока.');
        return {id:b.id,type:b.type,text:b.text,fontSize:b.fontSize,color:b.color,verticalOffset:b.verticalOffset,fontKey:b.fontKey};
    });
    return {version:2,title:value.title,totalLength:value.totalLength,boardHeight:value.boardHeight,sectionLength:value.sectionLength,bgColor:value.bgColor,blocks,fonts};
}
export function encodeBuffer(buffer) {
    const bytes=new Uint8Array(buffer);let binary='';
    for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    return btoa(binary);
}
export function decodeBuffer(data) {
    return Uint8Array.from(atob(data),c=>c.charCodeAt(0)).buffer;
}
export function xml(value) {return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
export function layout(project,fonts) {
    const blocks=project.blocks.map(b=>{
        if(b.type==='logo')return {...b,width:b.fontSize*500/118};
        const font=fonts.get(b.fontKey);if(!font)throw new Error('Шрифт блока ещё не загружен.');
        return {...b,width:font.getAdvanceWidth(b.text,b.fontSize)};
    });
    const contentWidth=blocks.reduce((sum,b)=>sum+b.width,0);
    const free=project.sectionLength-contentWidth;
    const gap=blocks.length?Math.max(0,free)/blocks.length:0;
    let x=gap/2;
    return {contentWidth,free,gap,overflow:Math.max(0,-free),blocks:blocks.map(b=>{const out={...b,x};x+=b.width+gap;return out;})};
}
