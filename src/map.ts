import type { Map, GeoJSONSource, Marker } from 'maplibre-gl';
import { ORIGIN, type Landmark, type Mode } from './geometry';

export class CityMap {
  private map?: Map;
  private markers: { id: string; marker: Marker }[] = [];
  private alive = true;
  private selected?: Landmark;
  private mode: Mode = 'down';
  private street = true;
  private timeout?: ReturnType<typeof setTimeout>;
  private fallback: HTMLDivElement;
  private live: HTMLDivElement;
  private status: HTMLSpanElement;
  private toggle: HTMLButtonElement;
  constructor(private host: HTMLElement, private items: Landmark[], private select: (id: string) => void) {
    host.innerHTML = `<div class="coordinate-map"></div><div class="live-map" aria-label="台北街道地圖"></div><div class="map-compass" aria-hidden="true"><span>N</span><i></i><small>北</small></div><div class="map-heading"><span class="eyebrow">TAIPEI / 台北</span><h2>城市裡的幾何</h2></div><div class="map-bottom"><span class="map-status" role="status">載入街道地圖…</span><button class="map-toggle" type="button">使用座標地圖</button></div><div class="map-credit">地標：<a href="https://data.gov.tw/dataset/7777" target="_blank" rel="noopener">交通部觀光署</a> · <a href="https://data.gov.tw/license" target="_blank" rel="noopener">政府資料開放授權</a></div>`;
    this.fallback = host.querySelector('.coordinate-map')!;
    this.live = host.querySelector('.live-map')!;
    this.status = host.querySelector('.map-status')!;
    this.toggle = host.querySelector('.map-toggle')!;
    this.toggle.addEventListener('click', () => {
      this.street = !this.street;
      if (this.street) { if (this.map) this.activateStreet(); else void this.loadStreet(); }
      else this.showFallback('座標地圖 · 北方朝上');
    });
    this.draw();
    void this.loadStreet();
  }
  private showFallback(message: string) {
    if (!this.alive) return;
    this.street = false;
    this.live.classList.remove('ready');
    this.live.setAttribute('inert', '');
    this.fallback.removeAttribute('inert');
    this.status.textContent = message;
    this.toggle.textContent = '載入街道地圖';
    if (this.timeout) clearTimeout(this.timeout);
  }
  private activateStreet() {
    if (!this.alive || !this.street) return;
    this.live.classList.add('ready');
    this.live.removeAttribute('inert');
    this.fallback.setAttribute('inert', '');
    this.status.textContent = '街道地圖 · 北方朝上';
    this.toggle.textContent = '使用座標地圖';
    if (this.timeout) clearTimeout(this.timeout);
  }
  private async loadStreet() {
    this.status.textContent = '載入街道地圖…';
    this.timeout = setTimeout(() => this.showFallback('街道暫時無法載入 · 已切換座標地圖'), 6000);
    try {
      const { Map, Marker, NavigationControl } = await import('maplibre-gl');
      if (!this.alive) return;
      this.map = new Map({ container: this.live, center: [121.542,25.051], zoom: 12.4, minZoom: 10, maxZoom: 17, pitch: 0, dragRotate: false, touchPitch: false, attributionControl: { compact: true }, style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxzoom: 19 } }, layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.8 } }] } });
      this.map.touchZoomRotate.disableRotation();
      this.map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      this.map.on('error', () => this.showFallback('街道暫時無法載入 · 已切換座標地圖'));
      this.map.on('load', () => {
        if (!this.map || !this.alive) return;
        this.map.addSource('sightline', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        this.map.addLayer({ id: 'sightline', type: 'line', source: 'sightline', paint: { 'line-color': '#c8f57c', 'line-width': 3, 'line-dasharray': [3,2] } });
        this.update(this.selected, this.mode);
        this.activateStreet();
      });
      const origin = document.createElement('div');
      origin.className = 'origin-pin'; origin.textContent = '△101';
      new Marker({ element: origin }).setLngLat([ORIGIN.longitude,ORIGIN.latitude]).addTo(this.map);
      this.items.forEach((item,index) => {
        const button = document.createElement('button');
        button.className = 'live-pin'; button.textContent = String(index+1).padStart(2,'0');
        button.setAttribute('aria-label', `選擇${item.name}`); button.title = item.name;
        button.addEventListener('click', () => this.select(item.id));
        this.markers.push({id:item.id, marker: new Marker({element:button}).setLngLat([item.longitude,item.latitude]).addTo(this.map!)});
      });
    } catch { this.showFallback('使用座標地圖 · 所有探索功能仍可使用'); }
  }
  update(item: Landmark | undefined, mode: Mode) {
    this.selected = item; this.mode = mode; this.draw();
    this.markers.forEach(({id,marker}) => { marker.getElement().classList.toggle('selected',id===item?.id); marker.getElement().setAttribute('aria-pressed',String(id===item?.id)); });
    const source = this.map?.getSource('sightline') as GeoJSONSource | undefined;
    source?.setData(item ? {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[ORIGIN.longitude,ORIGIN.latitude],[item.longitude,item.latitude]]}} : {type:'FeatureCollection',features:[]});
  }
  private draw() {
    const cos = Math.cos(ORIGIN.latitude*Math.PI/180);
    const xkm = (lon: number) => (lon-ORIGIN.longitude)*111.195*cos;
    const ykm = (lat: number) => (lat-ORIGIN.latitude)*111.195;
    const xs = [0,...this.items.map(i=>xkm(i.longitude))]; const ys = [0,...this.items.map(i=>ykm(i.latitude))];
    const scale = Math.min(760/(Math.max(...xs)-Math.min(...xs)),390/(Math.max(...ys)-Math.min(...ys)));
    const cx = (Math.max(...xs)+Math.min(...xs))/2; const cy = (Math.max(...ys)+Math.min(...ys))/2;
    const pos = (lon: number,lat: number) => [500+(xkm(lon)-cx)*scale,340-(ykm(lat)-cy)*scale];
    const [ox,oy] = pos(ORIGIN.longitude,ORIGIN.latitude);
    const endpoint = this.selected ? pos(this.selected.longitude,this.selected.latitude) : undefined;
    this.fallback.innerHTML = `<svg viewBox="0 0 1000 680" role="group" aria-label="依真實座標排列的台北地標圖，北方朝上"><defs><pattern id="map-grid" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse"><path d="M${scale} 0H0V${scale}" fill="none" stroke="#ffffff06"/></pattern></defs><rect width="1000" height="680" fill="url(#map-grid)"/>${[2,4,6].map(k=>`<circle cx="${ox}" cy="${oy}" r="${k*scale}" fill="none" stroke="#c8f57c13" stroke-dasharray="3 5"/><text x="${ox-k*scale+10}" y="${oy-8}" class="ring-label">${k} km</text>`).join('')}${this.items.map(i=>{const [x,y]=pos(i.longitude,i.latitude);return `<path d="M${ox} ${oy}L${x} ${y}" stroke="#c8f57c10"/>`;}).join('')}${endpoint ? `<path class="map-sightline" d="M${ox} ${oy}L${endpoint[0]} ${endpoint[1]}"/><circle cx="${this.mode==='down'?ox:endpoint[0]}" cy="${this.mode==='down'?oy:endpoint[1]}" r="25" fill="#c8f57c18" stroke="#c8f57c55"/>` : ''}${this.items.map((item,index)=>{const [x,y]=pos(item.longitude,item.latitude);return `<g class="map-point ${item.id===this.selected?.id?'selected':''}" role="button" tabindex="0" aria-label="選擇${item.name}" aria-pressed="${item.id===this.selected?.id}" data-point="${item.id}" transform="translate(${x} ${y})"><circle r="18"/><text text-anchor="middle" dy="5">${String(index+1).padStart(2,'0')}</text><title>${item.name}</title></g>`;}).join('')}<g class="map-origin" transform="translate(${ox} ${oy})"><circle r="7"/><text x="15" y="5">△101</text></g></svg><div class="coordinate-note">真實地標座標 · 局部平面投影<br>不顯示街道與地形</div>`;
    this.fallback.querySelectorAll<SVGGElement>('[data-point]').forEach(point => {
      point.addEventListener('click',()=>this.select(point.dataset.point!));
      point.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();this.select(point.dataset.point!);}});
    });
  }
  destroy() { this.alive=false; if(this.timeout)clearTimeout(this.timeout); this.map?.remove(); }
}
