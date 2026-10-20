# 2026 资产署名及改编记录

本项目使用社区模型。下载来源与许可依据是实际下载页；原件、加工件的 SHA-256 见 asset-sources.json。

P23（2026-10-09）追加运行时材质修改：修正 OPAQUE / MASK / BLEND 状态与整车淡出，分别调整车漆、碳纤维、橡胶及金属表面的粗糙度和反射。GLB、UV、原涂装及贴图字节沿用 P22；修改实现见 source/material-v10.js 和 source/cinematic-engine.js。

| 资产 | 作者 / 来源 | 许可 | 接入 |
|---|---|---|---|
| ferrari-sf26 | [Dave Love SketchFab / Tyler_Dave](https://sketchfab.com/3d-models/2026-ferrari-sf-26-e5ca6cecdc42449283f4bed27360f2a7) | CC BY 4.0 | 主动画 + 资产库 |
| mclaren-mcl40 | [Dave Love SketchFab / Tyler_Dave](https://sketchfab.com/3d-models/2026-mclaren-mcl40-96214ad5624f42a0861f77008f8d29e7) | CC BY 4.0 | 主动画 + 资产库 |
| mercedes-w17 | [Dave Love SketchFab / Tyler_Dave](https://sketchfab.com/3d-models/2026-mercedes-w17-b806f1e70aa343219e7158169549b97b) | CC BY 4.0 | 主动画 + 资产库 |
| redbull-rb22 | [Dave Love SketchFab / Tyler_Dave](https://sketchfab.com/3d-models/2026-redbull-rb22-0a3d24a58e0549d591a5a48c22eec383) | CC BY 4.0 | 主动画 + 资产库 |
| aston-martin-amr26 | [Dave Love SketchFab / Tyler_Dave](https://sketchfab.com/3d-models/2026-aston-martin-amr26-a50d1c7bc086455c9412470d93fc3fc7) | CC BY 4.0 | 资产库 |
| williams-fw48 | [Dave Love SketchFab / Tyler_Dave](https://sketchfab.com/3d-models/2026-williams-fw48-4efa51e6d64a4192a83418f1b715c671) | CC BY 4.0 | 资产库 |
| haas-vf26 | [Dave Love SketchFab / Tyler_Dave](https://sketchfab.com/3d-models/2026-haas-vf-26-1f41e03886724bc6acd16c92402989bc) | CC BY 4.0 | 资产库 |
| audi-r26 | [Dave Love SketchFab / Tyler_Dave](https://sketchfab.com/3d-models/2026-audi-r26-32bf228264b047669b100b0f1b8769ac) | CC BY 4.0 | 资产库 |
| cadillac-mac26 | [Dave Love SketchFab / Tyler_Dave](https://sketchfab.com/3d-models/2026-cadillac-mac-26-95bcd37aa7c649779efc33b90b6c023e) | CC BY 4.0 | 主动画 + 资产库 |
| monza-2020 | [Dave Love SketchFab / Tyler_Dave](https://sketchfab.com/3d-models/autodromo-nazionale-monza-circuit-2020-layout-25ed955115094de382935aa6d1a1e9c6) | CC BY 4.0 | 完整赛道库 + 主场景改编 |
| spa-2022 | [Dave Love SketchFab / Tyler_Dave](https://sketchfab.com/3d-models/circuit-de-spa-francorchamps-2022-layout-ac681fbf548144498c130c3aa0adeb54) | CC BY 4.0 | 完整赛道库 |
| alpine-a526 | [Fongu](https://sharemods.com/tlhq1t1n564n/2026_Alpine__AMR__Cadillac_by_fongu.7z.html) | 用户已确认作者转换与使用许可 | 资产库 |
| racing-bulls-vcarb03 | [Isaint](https://www.mediafire.com/file/s6gdc6izm37haq5/F1-2026%2BRB%2BVCR03-Isaint.rar/file) | 用户已确认作者转换与使用许可 | 资产库 |

CC BY 4.0：https://creativecommons.org/licenses/by/4.0/ 。Sketchfab 上传者主页：https://sketchfab.com/Tyler_Dave 。

改编：源节点变换合并，赛车统一为前方 −X / 上方 Y / 左侧 +Z；四轮按实际轮心拆分，翼片保留完整组件。贴图限长边 1024px；透明贴图未被替换，修复原导出中将 decal、glass、tree、fence 等材质写为不透明的设置。未简化赛车三角面。

GP4：Fongu（Alpine A526）、Isaint（Racing Bulls VCARB03）的包内说明保存在 assets/licenses/。2026-10-08 用户确认拥有两位作者的转换与使用许可。GP4 左手坐标系转换成 glTF 右手系时校正左右方向及绕向，保留原 UV 与 TEX 内 DDS 像素；alpha 用作镜面数据的车身不当作透明。两包缺独立轮胎，补充使用 Dave Love / Tyler_Dave 的 RB22 四轮作为共享部件，按悬挂端点对齐。Alpine 缺辅助 glass 图，使用通用玻璃材质。

赛道：Monza 2020、Spa 2022 全布局几何保留；改变原点、压缩贴图、恢复透明裁切，并为灰白草地细节贴图加绿色反照率。主动画只改编 Monza 维修区建筑及围栏：去除坡度并沿自定义路线布置，保留既有立体树林。不能把改编路线称为真实蒙扎布局。

程序基础：现有捆绑 Three.js，Copyright 2010–2026 Three.js Authors，MIT。GP4 Mesh Tools / DDS-Utils 仅作为格式文档参考，未安装或执行，参考工具包不进入交付 ZIP。

旧模型及 Qvist 概念车署名文件仍作为历史资料保留，不是 P22 主动画所用资产。

Haas / Williams：原 GLB 内嵌通用 FIA 底版；接回同一下载包作者提供的 chassis、chassis2、decals（Haas 另含轮毂）贴图，并上下翻转以匹配原 GLB 的 UV 原点。加工记录保存每张原图 SHA-256。资产库增加本地中性反射环境以显示原金属材质，不改变原 PBR 参数。

## Public source distribution · 2026-10-20

The project owner has confirmed author permission to publicly redistribute the converted Alpine A526 and Racing Bulls VCARB03 GLB assets. Blender sources are not included. This permission applies to the supplied GLBs; it is not a new blanket MIT license for third-party art or a general permission for other conversions. Original author notices remain above.
