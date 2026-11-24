# 免费免 Key 天气与地名搜索源调研

> 日期：2026-11-24。问题：排查「镇远」天气不准的原因，调研全网免费、无需 API Key、支持 HTTPS JSON 的天气与地名搜索源，供 `@fuyu/weather` 插件实现多源切换与自动故障切换。范围：检索国内外公开免 Key 天气接口，并用本机脚本对贵州镇远（27.05°N, 108.43°E）及海外坐标实测连通性、延迟与数据准确度。

## 结论

1. **「镇远」天气严重偏差的直接原因是地名库缺漏**：实测 Open-Meteo Geocoding（底层 GeoNames）收录不全，搜「镇远」只返回海南省的镇远（18.52°N，实测 22.1°C），搜「镇远县」返回空，导致贵州镇远（7–11°C）错查成热带气候。改用 **OpenStreetMap Photon（`photon.komoot.io`）+ Open-Meteo Geocoding 双源合并**后，搜「镇远」首位即准确命中「镇远 · 贵州省 · 中国」。
2. **接入 5 个实测可用、免费免 Key、纯 HTTPS JSON 的天气源**，支持用户手动切换及失败自动降级：
   - **中央气象台 NMC（`www.nmc.cn`）**：中国大陆 2500+ 县市官方地面气象站实况（贵州镇远实测 8.3°C、含 7 天预报与日出日落），`auto` 模式下中国城市首选，并按需融合逐小时预报；
   - **Open-Meteo（自动最佳 `best_match`）**：全球覆盖、字段最全（实时、24h 逐小时、7 天、15 分钟降雨预警、日出日落、UV、配套 AQI）；
   - **Open-Meteo（中国气象局模式 `cma_grapes_global`）**：同域名零新增权限，中国区域数值预报贴合度优于通用全球模式；
   - **MET Norway（`api.met.no` Locationforecast 2.0）**：挪威气象局官方全球免费源，仅要求规范 `User-Agent`，贵州镇远实测 8.4°C（与中央气象台官测仅差 0.1°C），含逐小时、9 天预报与 1 小时降水量；
   - **wttr.in（`wttr.in`）**：免费免 Key 全球兜底源（实时 + 逐 3 小时 + 3 天预报）。
3. **自动策略（`auto`）**：中国城市按「中央气象台（融合 Open-Meteo 逐小时）→ Open-Meteo CMA → MET Norway → Open-Meteo → wttr.in」自动切换；海外城市按「Open-Meteo → MET Norway → wttr.in」自动切换。手动选定任一源且开启「失败时自动切换备用源」（默认开）时，单源超时或地区不支持会自动降级并在页面底部注明实际生效来源。

## 详细实测（2026-11-24）

### 地名搜索（测试词：「镇远」）

| 服务 | 协议 / 鉴权 | 实测耗时 | 搜「镇远」结果 | 结论 |
|---|---|---|---|---|
| **Photon (`photon.komoot.io`)** | HTTPS / 免 Key | ~1.0s | 首位「镇远 · 贵州省 · 中国 (27.04, 108.41)」，含「镇远县」 | **采用（与 Open-Meteo 并行合并）** |
| **Open-Meteo Geocoding** | HTTPS / 免 Key | ~1.4s | 仅返回海南省镇远；搜「镇远县」空 | **保留（补全球大城市与时区）** |
| OpenStreetMap Nominatim | HTTPS / 免 Key | >8s 超时 | 请求超时 | 排除（公共实例限速严） |

### 天气预报源（贵州镇远 27.05°N, 108.43°E，实测时间 2026-11-25 03:15 CST）

| 数据源 | 域名 | 免 Key / HTTPS | 实测耗时 | 镇远实况 | 覆盖范围与数据完整度 | 结论 |
|---|---|---|---|---|---|---|
| **中央气象台 NMC** | `www.nmc.cn` | 免 Key / HTTPS | 0.3–0.9s | 8.3°C（官测），4°/16° | 仅中国大陆；地面站实况 + 7 天 + 日出日落 + 实时 AQI，缺未来逐小时 | **接入（中国自动首选）** |
| **MET Norway** | `api.met.no` | 免 Key（需 UA）/ HTTPS | ~1.5s | 8.4°C，晴间多云 | 全球；实时 + 48h 逐小时 + 9 天 + 1h 降水 | **接入** |
| **Open-Meteo (自动)** | `api.open-meteo.com` | 免 Key / HTTPS | ~1.0s | 9.0°C，阴，7.3°/17.2° | 全球；实时 + 24h + 7 天 + 15 分钟降水 + 日出日落 + UV | **接入** |
| **Open-Meteo (CMA)** | `api.open-meteo.com` | 免 Key / HTTPS | ~1.0s | 贴合中国模式 | 全球（中国气象局 GRAPES 模式）；同上全字段 | **接入** |
| **wttr.in** | `wttr.in` | 免 Key / HTTPS | ~1.9s | 7°C，6°/12° | 全球；实时 + 逐 3 小时 + 3 天 + 日出日落 + UV | **接入（全球兜底）** |
| 7Timer! | `www.7timer.info` | 免 Key / HTTPS | ~4.0s | 7°C（3h 粗粒度） | 全球；响应慢、缺每日高低温与天气现象描述 | 不接入 |
| Bright Sky (DWD) | `api.brightsky.dev` | 免 Key / HTTPS | — | — | 仅德国及周边 | 不接入 |
| NWS | `api.weather.gov` | 免 Key / HTTPS | ~2.2s | — | 仅美国境内 | 不接入 |
| 中国天气网旧接口 | `www.weather.com.cn` | 免 Key / 仅 HTTP | — | — | 无 HTTPS，不满足浮屿受控 `ctx.http` 的 HTTPS 要求 | 不接入 |

## 来源

- Open-Meteo 文档与模式列表：https://open-meteo.com/en/docs
- MET Norway Locationforecast 2.0 文档：https://api.met.no/weatherapi/locationforecast/2.0/documentation
- Photon（Komoot OpenStreetMap 搜索）：https://photon.komoot.io/
- wttr.in JSON 接口说明：https://github.com/chubin/wttr.in
- 中央气象台公开数据接口（网页端 JSON）：https://www.nmc.cn/
- Bright Sky（DWD 开放天气）：https://brightsky.dev/
