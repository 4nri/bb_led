import {STORAGE_KEY,validateProject,decodeBuffer,encodeBuffer,LIMITS,uid} from './model.mjs';
export function saveProject(project) {
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(project));return true; } catch {return false;}
}
export function readSavedProject() {
    const raw=localStorage.getItem(STORAGE_KEY);
    return raw?validateProject(JSON.parse(raw)):null;
}
export async function prepareFonts(project,assets) {
    const prepared=new Map();
    for(const [key,value] of Object.entries(project.fonts)) {
        if(assets.fonts.has(key))continue;
        const buffer=decodeBuffer(value.data);
        const font=opentype.parse(buffer);
        if(!font.supported)throw new Error(`Шрифт «${value.name}» не поддерживается.`);
        prepared.set(key,font);
    }
    return prepared;
}
export async function importProject(file,assets) {
    if(file.size>20*1024*1024)throw new Error('Файл проекта должен быть меньше 20 МБ.');
    const project=validateProject(JSON.parse(await file.text()));
    const fonts=await prepareFonts(project,assets);
    for(const [key,font] of fonts)assets.fonts.set(key,font);
    return project;
}
export async function uploadFont(file,assets) {
    if(file.size>LIMITS.fontBytes)throw new Error('Файл шрифта должен быть меньше 5 МБ.');
    if(!/\.(otf|ttf|woff)$/i.test(file.name))throw new Error('Выберите шрифт OTF, TTF или WOFF.');
    const buffer=await file.arrayBuffer();
    const font=opentype.parse(buffer);
    if(!font.supported)throw new Error('Этот шрифт не поддерживается.');
    const key=`custom-${uid()}`;
    assets.fonts.set(key,font);
    return {key,value:{name:file.name,data:encodeBuffer(buffer)}};
}
export function download(data,name,type) {
    const url=URL.createObjectURL(new Blob([data],{type}));
    const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
}
