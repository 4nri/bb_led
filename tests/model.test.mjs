import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {newProject,validateProject,sectionStats,layout,divisors,encodeBuffer,decodeBuffer} from '../js/model.mjs';
import {svgDocument} from '../js/geometry.mjs';
const require=createRequire(import.meta.url);
const opentype=require('../vendor/opentype.min.js');
const font=opentype.loadSync(new URL('../fonts/ONYTrack-CompressedBlack.otf',import.meta.url).pathname);
const assets={fonts:new Map([['ony',font]]),logoPaths:['M0 0H500V118H0Z']};
test('manual section reports every uncovered pixel',()=>{
    const p=newProject();p.sectionLength=2500;
    assert.deepEqual(sectionStats(p),{count:9,remainder:2460,covered:22500});
    p.sectionLength=30000;assert.deepEqual(sectionStats(p),{count:0,remainder:24960,covered:0});
});
test('horizontal overflow never creates negative gaps or positions',()=>{
    const p=newProject();p.sectionLength=104;
    const result=layout(p,assets.fonts);
    assert.ok(result.overflow>0);assert.equal(result.gap,0);assert.equal(result.blocks[0].x,0);
    assert.ok(result.blocks[1].x>=result.blocks[0].width);
});
test('blank layout and valid layout stay finite',()=>{
    const p=newProject();const result=layout(p,assets.fonts);
    assert.ok(result.gap>0);assert.ok(result.blocks.every(b=>Number.isFinite(b.x)));
    p.blocks=[];assert.deepEqual(layout(p,assets.fonts),{contentWidth:0,free:2496,gap:0,overflow:0,blocks:[]});
});
test('project input rejects invalid dimensions, colors, font keys and duplicate IDs',()=>{
    const p=newProject();assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
    for(const value of [0,-1,NaN,Infinity,1.5,'96',1000001])assert.throws(()=>validateProject({...p,totalLength:value}));
    assert.throws(()=>validateProject({...p,bgColor:'url(https://bad.invalid)'}));
    assert.throws(()=>validateProject({...p,blocks:[p.blocks[0],p.blocks[0]]}));
    assert.throws(()=>validateProject({...p,blocks:[{...p.blocks[1],fontKey:'missing'}]}));
});
test('custom font buffers survive a project roundtrip',()=>{
    const bytes=new Uint8Array([0,255,128,67]);
    assert.deepEqual(new Uint8Array(decodeBuffer(encodeBuffer(bytes.buffer))),bytes);
    const p=newProject();p.fonts['custom-test']={name:'font.otf',data:encodeBuffer(bytes.buffer)};
    p.blocks[1].fontKey='custom-test';assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
});
test('full board includes a partial last section and exact requested dimensions',()=>{
    const p=newProject();p.sectionLength=2500;
    const svg=svgDocument(p,assets,'board');
    assert.match(svg,/width="24960" height="96"/);
    assert.equal((svg.match(/<use /g)||[]).length,10);
    assert.match(svg,/<use href="#section" x="22500"\/>/);
    assert.match(svg,/<svg id="section" width="2500" height="96"/);
    assert.doesNotMatch(svg,/<text|<image|NaN|Infinity|http[^:]*:\/\/(?!www.w3.org)/);
});
test('intentional vertical crop and default font metrics are retained',()=>{
    const p=newProject(),b=p.blocks[1];
    assert.equal(b.fontSize,138);assert.equal(b.verticalOffset,5);
    const bounds=font.getPath(b.text,0,0,b.fontSize).getBoundingBox();
    assert.ok(bounds.y2-bounds.y1>p.boardHeight);
    assert.doesNotMatch(svgDocument(p,assets),/<animate|<text|font-family/);
});
test('extreme repetition is rejected instead of building an unbounded SVG',()=>{
    const p=newProject();p.totalLength=1000000;p.sectionLength=1;
    assert.throws(()=>svgDocument(p,assets,'board'),/Слишком много повторений/);
});
test('section candidates divide total length without remainder',()=>{
    const values=divisors(24960);assert.ok(values.includes(2496));assert.ok(values.every(n=>24960%n===0));
});
