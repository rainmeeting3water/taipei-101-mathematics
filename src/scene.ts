import '@arcgis/core/assets/esri/themes/dark/main.css';
import Map from '@arcgis/core/Map.js';
import SceneView from '@arcgis/core/views/SceneView.js';
import type LayerView from '@arcgis/core/views/layers/LayerView.js';
import IntegratedMeshLayer from '@arcgis/core/layers/IntegratedMeshLayer.js';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer.js';
import Basemap from '@arcgis/core/Basemap.js';
import Point from '@arcgis/core/geometry/Point.js';
import Polyline from '@arcgis/core/geometry/Polyline.js';
import Graphic from '@arcgis/core/Graphic.js';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import Camera from '@arcgis/core/Camera.js';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils.js';
import { ORIGIN, type Landmark, type Mode } from './geometry';
import { observationLocations, offsetPoint, pairCalculation, type ScenePair, type Endpoint } from './scene-geometry';
const MESH='https://www.historygis.udd.gov.taipei/arcgis/rest/services/Hosted/'+encodeURIComponent('信義計畫區_20221222')+'/SceneServer/layers/0';

export class CityScene {
  private view?:SceneView;
  private meshView?:LayerView;
  private alive=true;
  private pair?:ScenePair;
  private selected?:Landmark;
  private mode:Mode;
  private graphics=new GraphicsLayer({elevationInfo:{mode:'absolute-height'},title:'教學幾何：未驗證可視性'});
  private status:HTMLElement;
  private eye:HTMLElement;
  private headingOffset=0;
  private controls:HTMLButtonElement[]=[];
  private ready=false;
  private abort=new AbortController();
  constructor(private host:HTMLElement, private item:Landmark, mode:Mode, private onPair:(pair:ScenePair)=>void, private onFallback:()=>void) {
    this.mode=mode;
    host.innerHTML=`<div class="scene-canvas" aria-label="台北實景3D場景"></div><div class="scene-top"><span class="scene-label">實景3D · 信義計畫區 2022</span><span class="scene-status" role="status">載入台北市實景模型…</span></div><div class="scene-reticle" aria-hidden="true">＋</div><div class="scene-bottom"><div class="scene-eye">準備模擬視點…</div><div class="scene-controls" role="group" aria-label="固定觀察位置轉動視線"><button data-turn="-15" disabled>向左看</button><button data-turn="0" disabled>對準地標</button><button data-turn="15" disabled>向右看</button><button class="fallback-button">2D備援</button></div><p class="visibility-note">模擬視點 · 未驗證實際可視性</p><div class="scene-attribution"><a href="https://uddtp.gitbook.io/tpgis/ch6/6.2" target="_blank" rel="noopener">實景：臺北市都發局</a> · <a href="https://maps.nlsc.gov.tw" target="_blank" rel="noopener">底圖：國土測繪中心</a> · Powered by Esri</div></div>`;
    this.status=host.querySelector('.scene-status')!;this.eye=host.querySelector('.scene-eye')!;
    this.controls=Array.from(host.querySelectorAll<HTMLButtonElement>('[data-turn]'));
    this.controls.forEach(button=>button.addEventListener('click',()=>{const amount=Number(button.dataset.turn);this.headingOffset=amount===0?0:this.headingOffset+amount;void this.applyCamera(false);}));
    host.querySelector('.fallback-button')!.addEventListener('click',onFallback);
    void this.load();
  }
  private async load() {
    try {
      const mesh=new IntegratedMeshLayer({url:MESH,title:'臺北市都發局：信義計畫區實景模型（2022）',copyright:'臺北市政府都市發展局 · 信義計畫區2022實景模型'});
      const imagery=new WebTileLayer({urlTemplate:'https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{level}/{row}/{col}',copyright:'內政部國土測繪中心 · 正射影像',maxScale:0});
      const map=new Map({basemap:new Basemap({baseLayers:[imagery]}),ground:{navigationConstraint:{type:'none'}},layers:[mesh,this.graphics]});
      this.view=new SceneView({container:this.host.querySelector('.scene-canvas') as HTMLDivElement,map,viewingMode:'local',qualityProfile:'low',spatialReference:{wkid:3857},camera:{position:{longitude:ORIGIN.longitude-0.0005,latitude:ORIGIN.latitude+0.0005,z:400},heading:328,tilt:65},ui:{components:[]},environment:{background:{type:'color',color:[155,189,210,1]},atmosphereEnabled:true,starsEnabled:false,lighting:{date:new Date('2026-10-04T03:00:00Z'),directShadowsEnabled:false}},constraints:{tilt:{max:179,mode:'manual'}}});
      let dragStart=0, startHeading=0;
      this.view.on('drag',event=>{event.stopPropagation();if(event.action==='start'){dragStart=event.x;startHeading=this.headingOffset;}if(event.action==='update'){this.headingOffset=startHeading-(event.x-dragStart)*0.18;void this.applyCamera(false);}});
      this.view.on('mouse-wheel',event=>event.stopPropagation());
      this.view.on('double-click',event=>event.stopPropagation());
      this.view.on('key-down',event=>{event.stopPropagation();if(event.key==='ArrowLeft'||event.key==='ArrowRight'){this.headingOffset+=event.key==='ArrowLeft'?-5:5;void this.applyCamera(false);}});
      await Promise.all([this.view.when(),mesh.load()]);
      if(!this.alive)return;
      this.meshView=await this.view.whenLayerView(mesh);
      const locations=observationLocations(this.item);

      this.status.textContent='從同一實景模型對齊高程…';
      // A near-base reference avoids sampling the tower roof at its centre.
      const baseLocation=offsetPoint(ORIGIN.longitude,ORIGIN.latitude,115,235);
      const base=await this.sampleSurface(mesh,baseLocation,true);
      const low=await this.sampleSurface(mesh,locations.low,false);
      if(!this.alive)return;
      this.pair={high:{...locations.high,altitude:base.altitude+ORIGIN.height},low:{...locations.low,altitude:low.altitude+1.6},originGround:base.altitude,landmarkGround:low.altitude,terrainResolution:0,baseReference:base,lowReference:low,highOffset:locations.highOffset,lowOffset:locations.lowOffset};
      this.status.textContent='預載地面仰望101的模型細節…';
      const up=pairCalculation(this.pair,'up');
      await this.view.goTo(new Camera({position:{longitude:this.pair.low.longitude,latitude:this.pair.low.latitude,z:this.pair.low.altitude,spatialReference:{wkid:4326,vcsWkid:5773}},heading:up.bearing,tilt:90+up.angle,fov:70}),{animate:false});
      try{await this.waitForMesh();}catch{if(!this.alive)return;this.status.textContent='視點已校準，模型細節仍在載入…';}
      if(!this.alive)return;
      this.host.dataset.pair=JSON.stringify(this.pair);
      this.onPair(this.pair);
      this.ready=true;
      this.controls.forEach(b=>b.disabled=false);
      this.addGeometry();
      await this.applyCamera(false);
      reactiveUtils.watch(()=>this.view?.updating||this.meshView?.updating,updating=>{if(this.alive)this.status.textContent=updating?'實景模型細節載入中…':'實景模型已載入';},{initial:true});
    } catch(error) {
      if(!this.alive)return;
      console.warn('Taipei 3D unavailable',error instanceof Error?error.message:'unknown');
      this.status.textContent='實景暫時無法載入，可使用2D備援；3D尚未完成載入';
      this.eye.textContent='保留地標與數學功能，請點「2D備援」';
    }
  }
  private async waitForMesh() {
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    const signal=AbortSignal.any([this.abort.signal,AbortSignal.timeout(45000)]);
    await reactiveUtils.whenOnce(()=>!!this.view&&!this.view.updating&&!this.meshView?.updating,{signal});
  }
  private async sampleSurface(mesh:IntegratedMeshLayer,location:{longitude:number;latitude:number},nearBase:boolean,altitude=600):Promise<Endpoint> {
    const view=this.view!;
    await view.goTo(new Camera({position:{...location,z:altitude,spatialReference:{wkid:4326,vcsWkid:5773}},heading:0,tilt:0,fov:40}),{animate:false});
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    // Only accept an actual mesh intersection. No zero-height ground substitute.
    const offsets=nearBase?[[0,0],[-25,0],[25,0],[0,-25],[0,25]]:[[0,0]];
    let previous:Endpoint|undefined;let stable=0;
    for(let attempt=0;attempt<60;attempt++){
      if(!this.alive)throw new Error('Scene closed');
      const points=offsets.map(([x,y])=>view.toMap({x:view.width/2+x,y:view.height/2+y},{include:[mesh],exclude:[view.map!.ground]})).filter((p):p is Point=>!!p&&typeof p.z==='number'&&Number.isFinite(p.z));
      if(points.length){
        const point=points.reduce((a,b)=>a.z!<b.z!?a:b);
        const sampled={longitude:point.longitude!,latitude:point.latitude!,altitude:point.z!};
        const onTarget=nearBase||(Math.abs(sampled.longitude-location.longitude)<0.00003&&Math.abs(sampled.latitude-location.latitude)<0.00003);
        stable=onTarget&&previous&&Math.abs(sampled.altitude-previous.altitude)<0.15?stable+1:0;
        previous=sampled;
        if(stable>=3&&!this.meshView?.updating)return sampled;
      }else{stable=0;previous=undefined;}
      await new Promise(resolve=>setTimeout(resolve,750));
    }
    throw new Error('No stable surface sample from the actual 3D mesh');
  }
  update(item:Landmark|undefined,mode:Mode) {
    this.selected=item;this.mode=mode;this.headingOffset=0;
    this.addGeometry();void this.applyCamera(true);
  }
  private addGeometry() {
    this.graphics.removeAll();if(!this.pair||!this.selected)return;
    const p=this.pair;const coordinates=(v:Endpoint)=>[v.longitude,v.latitude,v.altitude];
    this.graphics.add(new Graphic({geometry:new Polyline({hasZ:true,spatialReference:{wkid:4326},paths:[[coordinates(p.high),coordinates(p.low)]]}),symbol:{type:'line-3d',symbolLayers:[{type:'line',material:{color:[200,245,124,.95]},size:2}]},attributes:{label:'教學視線；未驗證實際可視性'}}));
    [p.high,p.low].forEach((v,index)=>this.graphics.add(new Graphic({geometry:new Point({longitude:v.longitude,latitude:v.latitude,z:v.altitude}),symbol:{type:'point-3d',symbolLayers:[{type:'icon',resource:{primitive:'circle'},material:{color:index===0?'#c8f57c':'#ffffff'},size:10,outline:{color:'#15251e',size:1}}]},attributes:{label:index===0?'101模擬觀景點':'國父紀念館模擬起點'}})));
  }
  private async applyCamera(animate:boolean) {
    if(!this.ready||!this.view||!this.pair||!this.alive)return;
    if(this.mode==='up'&&!this.selected){this.eye.textContent='選擇你的起點，進入城市中的模擬觀察位置';return;}
    const p=this.pair; const eye=this.mode==='down'?p.high:p.low;const c=pairCalculation(p,this.mode);
    const tilt=this.mode==='down'?90-c.angle:90+c.angle;
    const camera=new Camera({position:new Point({longitude:eye.longitude,latitude:eye.latitude,z:eye.altitude,spatialReference:{wkid:4326,vcsWkid:5773}}),heading:c.bearing+this.headingOffset,tilt,fov:70});
    this.eye.textContent=`${this.mode==='down'?'101模擬觀景點':'國父紀念館南側模擬起點'} · ${this.mode==='down'?'附近模型表面 +382 m':'眼高 1.6 m'} · 視線 ${(c.bearing+this.headingOffset+360)%360<0?'':Math.round((c.bearing+this.headingOffset+360)%360)+'°'}`;
    this.host.dataset.mode=this.mode;
    this.host.dataset.camera=JSON.stringify({longitude:eye.longitude,latitude:eye.latitude,altitude:eye.altitude,heading:camera.heading,tilt:camera.tilt});
    try {if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)await this.view.goTo(camera,{duration:1200});else this.view.camera=camera;} catch {/* Subsequent camera action may intentionally interrupt a transition. */}
    if(this.alive && this.view){const actual=this.view.camera;this.host.dataset.actualCamera=JSON.stringify({longitude:actual.position.longitude,latitude:actual.position.latitude,altitude:actual.position.z,heading:actual.heading,tilt:actual.tilt});}
  }
  destroy(){this.alive=false;this.abort.abort();this.view?.destroy();}
}
