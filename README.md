# △101 — See Taipei Through Mathematics

用三角看見台北。從101高度附近俯瞰信義區，再到國父紀念館南側仰望101，以同一組端點探索距離、方位與俯角／仰角。

## Problem / Concept

平面地圖難以呈現「我在哪裡、正在向上或向下看」。△101把地理位置與三角關係放進可轉動視線的3D城市，讓學習從觀察開始。

## Live Demo

[開啟 △101 公開體驗](https://taipei-101-mathematics.netlify.app/) · [GitHub repository](https://github.com/rainmeeting3water/taipei-101-mathematics)。本機預覽 `http://127.0.0.1:5173/`。

## How It Works — Look Down / Look Up

1. 首頁先預載官方實景服務，待「實景已準備好」再開始錄影或現場展示。
2. 點「台北101」：入口上浮、顯示「俯瞰」，進入高處模擬觀察位置。
3. 選「國父紀念館」：查看模型、距離、方位、俯角與三角形。
4. 切「仰望」，或回首頁點「台北市」再選同一地點：相機移到低處端點，朝向高處端點。
5. 點「看見俯角與仰角的關係」。左右按鈕、拖曳及方向鍵可固定位置轉動視線，「對準地標」復位。

目前先驗收一組雙視角；原先8筆已查證景點資料仍保留在 `src/landmarks.json`，沒有擴充景點、測驗或多語功能。

## Mathematics

3D模式由同一個 `ScenePair` 提供兩個端點，切換模式只交換觀察者與目標：

- 高處：101代表座標朝紀念館偏移70m；取101西南側附近模型表面高程，再加382m。
- 低處：紀念館代表座標朝101偏移120m；取該位置模型表面高程，再加1.6m眼高。
- 偏移為減少相機在模型內的模擬視點，並非實際室內拍攝位置。
- 兩處表面取樣同源於信義計畫區模型；服務標示垂直基準EPSG:5773（EGM96）。不混用其他高程基準的DEM。
- 模型表面可能包含植栽／構造物，不能當作測量級裸地。端點於表面穩定、模型停止更新後固定，往返使用同一組。

`d = Turf distance(high, low)`；以球面地表距離作局部平面水平距離近似。

`Δh = z_high - z_low`；`θ = atan2(Δh, d) × 180 / π`。

方位以Turf bearing計算，正北0°、順時針，兩方向分別計算。ArcGIS相機 tilt 為俯瞰 `90° − θ`，仰望 `90° + θ`。俯角由觀察者水平線向下量；仰角由水平線向上量。局部平面模型的水平線平行，內錯角相等；忽略曲率與折射。互動觀察本身不構成數學證明。

2D備援採舊版同高地面模型，數值可能不同，介面會清楚標示。

## Tech Stack

Vite、TypeScript、Turf.js；主場景使用 **ArcGIS Maps SDK for JavaScript 5.1.26** 的 IntegratedMeshLayer / SceneView。MapLibre GL JS 6.12.0只供2D備援。無後端、資料庫、帳號、付費服務或API金鑰。

沿用既有資料、數學核心與首頁。選擇ArcGIS是因官方來源為I3S整合網格；不是把傾斜平面地圖稱為觀景台視角。

## Data Sources

| 資料 | 來源與使用方式 |
| --- | --- |
| 實景3D | [臺北市都發局公開3D服務](https://uddtp.gitbook.io/tpgis/ch6/6.2)，信義計畫區20221222，I3S 1.5、ContextCapture影像紋理模型。直接介接官方服務，不打包或重製發佈模型。 |
| 模型目錄 | [都市設計3D圖資](https://uddtp.gitbook.io/tpgis/ch2-1/2.4)。本次核對範圍約121.55826–121.57546E、25.02767–25.04193N，包含101與所選紀念館視點。 |
| 影像底圖 | [國土測繪中心 WMTS](https://maps.nlsc.gov.tw/S09SOA/pro/Wmts_ajax_main.jsp)，PHOTO2正射影像。模型範圍外仍為平面影像。 |
| 景點座標 | [交通部觀光署景點資料庫](https://data.gov.tw/dataset/7777)，[政府資料開放授權條款第1版](https://data.gov.tw/license)。各筆保留來源紀錄識別碼。 |
| 封面照片 | [Taipei101-Night view — Zion C](https://commons.wikimedia.org/wiki/File:Taipei101-Night_view.jpg)，[CC0](https://creativecommons.org/publicdomain/zero/1.0/)，實際台北夜景。 |
| 2D備援 | OpenStreetMap contributors；外部底圖不可用時顯示內建座標示意。 |

供應商來源標示保留在場景與資料說明中。模型服務的免費介接指引不等於可大量下載再散布模型的授權。

## Local Development

Node.js 24。

```sh
npm ci
npm run dev
npm test
npm run check
npm run build
npm run preview
```

`npm ci`從npm下載lockfile指定套件並可執行套件安裝腳本。`build`先檢查TypeScript，再輸出靜態檔案到`dist/`；不會自行上傳。部署只發佈`dist/`，不得發佈整個repository、node_modules或工作檔。Netlify設定見`netlify.toml`。

## Hack Day — 60 Second Demo

先完成實景預載，再開始計時：0–5秒首頁；5–12秒點101；12–25秒選紀念館與看俯角；25–32秒回首頁點台北市；32–45秒選同一地點仰望；45–55秒展開相等角度；55–60秒回到雙入口。

## Limitations

- 完成的是**信義計畫區局部真實影像紋理3D**，不是全台北、即時實景、街景照片或室內觀景台。
- 模型為2022資料；地面視角可能有模糊、變形、洞或遮擋，不能承諾現場同等視野。
- **未驗證實際可視性**：教學連線與端點標記不是遮蔽分析結果。
- 首次下載SDK與實景可能需要數十秒，取決於裝置與官方服務；部分模型細節請求可能失敗。預載後可完成短演示，但冷啟動不保證60秒。
- 手機需要支援WebGL的現代瀏覽器；2D備援可保留數學互動，並不代表3D驗收完成。
- 無金鑰、無付費服務；可用性與模型涵蓋範圍受官方公開服務限制。若要全市高品質地面實景，仍需查證更多模型、授權及服務效能。

Build for Taipei × Make Learning Personal


