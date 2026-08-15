# 对局详情 1:1 还原（Server 端）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 league-akari-server（Spring Boot 3 + MyBatis-Plus + MySQL，端口 8081）新增对局时间线（frames）写入/查询接口，并扩展列表 DTO 为折叠卡提供轻量参与者数据。

**架构：** 沿用现有"全量 JSON 入库"策略：新增 `match_timeline` 表（game_id 唯一键 + frames_json 全量），POST 幂等、GET 404 兜底；列表接口在现有 `MatchSummaryResponse` 上增加 `participants` 轻量数组与 self 的强化/符文/多杀字段，提取逻辑复用 `parseStatsJson`/`statInt` 模式（LCU/SGP 双源字段名一致，缺失写 0/null）。

**技术栈：** Spring Boot 3.x + Java 17 + MyBatis-Plus + Flyway + JUnit/MockMvc。

**规格：** `D:/IDE/project/league-akari-web/docs/superpowers/specs/2026-08-15-match-detail-1to1-design.md` 第 4 节

---

### 任务 1：match_timeline 表 + 实体/Mapper

**文件：**
- 创建：`src/main/resources/db/migration/V2__match_timeline.sql`
- 创建：`src/main/java/com/leagueakari/entity/MatchTimeline.java`
- 创建：`src/main/java/com/leagueakari/mapper/MatchTimelineMapper.java`

- [ ] **步骤 1：编写迁移脚本**

`V2__match_timeline.sql`（每字段加 COMMENT，与 V1 风格一致）：
```sql
-- 对局时间线表：frames 全量 JSON 入库，game_id 唯一键承担幂等兜底
CREATE TABLE match_timeline (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    game_id     BIGINT UNSIGNED NOT NULL COMMENT 'LCU 对局 ID，幂等键',
    frames_json JSON            NOT NULL COMMENT '时间线 frames 数组全量（原样存储）',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '落库时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_timeline_game_id (game_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '对局时间线表';
```

- [ ] **步骤 2：实体与 Mapper**

`MatchTimeline.java`：`@TableName("match_timeline")`，字段 id/gameId/framesJson/createdAt（参照 `Match.java` 的注解与 `@TableId(type = IdType.AUTO)` 模式）。
`MatchTimelineMapper.java`：`extends BaseMapper<MatchTimeline>`（参照 `MatchMapper.java`）。

- [ ] **步骤 3：验证**

运行：`mvn flyway:migrate`（或启动应用执行迁移）并 `mvn test`
预期：迁移成功，测试通过。

- [ ] **步骤 4：Commit（在 league-akari-server 仓库）**

```bash
git add src/main/resources/db/migration/V2__match_timeline.sql src/main/java/com/leagueakari/entity/MatchTimeline.java src/main/java/com/leagueakari/mapper/MatchTimelineMapper.java
git commit -m "feat(timeline): match_timeline 表与实体/Mapper（frames 全量入库）"
```

---

### 任务 2：timeline 写入与查询接口

**文件：**
- 创建：`src/main/java/com/leagueakari/dto/TimelineSyncRequest.java`
- 创建：`src/main/java/com/leagueakari/service/MatchTimelineService.java`
- 修改：`src/main/java/com/leagueakari/controller/MatchController.java`
- 修改：`src/main/java/com/leagueakari/config/GlobalExceptionHandler.java`（若需新增 404 类型）
- 测试：`src/test/java/com/leagueakari/service/MatchTimelineServiceTest.java`、`src/test/java/com/leagueakari/controller/MatchTimelineControllerIntegrationTest.java`

- [ ] **步骤 1：编写失败的测试（service 幂等）**

`MatchTimelineServiceTest.java`：
```java
@SpringBootTest
class MatchTimelineServiceTest {

    @Autowired
    private MatchTimelineService service;

    @Test
    void 重复写入同一gameId幂等跳过() {
        service.saveTimeline(12345L, List.of(Map.of("timestamp", 1000)));
        service.saveTimeline(12345L, List.of(Map.of("timestamp", 2000))); // 重复推送
        // 断言库中仅一条且为首次写入内容
    }

    @Test
    void 查询不存在返回null() {
        assertNull(service.getTimeline(999999L));
    }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`mvn test -Dtest=MatchTimelineServiceTest`
预期：FAIL，service 不存在。

- [ ] **步骤 3：实现 DTO 与 Service**

`TimelineSyncRequest.java`：`@Data`，字段 `gameId`（`@NotNull Long`）、`frames`（`@NotNull Object`，原始 frames 数组原样接收，避免字段级校验破坏全量透传）。
`MatchTimelineService.java`：
- `saveTimeline(Long gameId, Object frames)`：先按 game_id 查重（存在即 log info "timeline 幂等命中 gameId=..." 并返回），不存在则 `writeJson(frames)` 存入 frames_json（复用 `MatchService.writeJson` 的 ObjectMapper 逻辑，注意其为 private——在 MatchTimelineService 内自带一个同款私有方法即可，避免改动 MatchService）。
- `getTimeline(Long gameId)`：查不到返回 null（controller 层转 404）；找到则把 frames_json 解析回 Object 返回。
- 关键业务节点日志：写入成功（含 gameId）、幂等命中、查询 404。

`MatchController.java` 追加：
```java
/** 接收时间线推送（frames 全量），幂等写入 */
@PostMapping("/{gameId}/timeline")
public Map<String, Object> syncTimeline(@PathVariable Long gameId,
        @Valid @RequestBody TimelineSyncRequest request) {
    matchTimelineService.saveTimeline(gameId, request.getFrames());
    return Map.of("code", 0);
}

/** 查询对局时间线，不存在返回 404 */
@GetMapping("/{gameId}/timeline")
public Map<String, Object> getTimeline(@PathVariable Long gameId) {
    Object frames = matchTimelineService.getTimeline(gameId);
    if (frames == null) {
        throw new MatchNotFoundException(gameId); // 复用现有异常，全局处理器转 404
    }
    return Map.of("data", frames);
}
```
`MatchNotFoundException` 现有构造是否接受 gameId 以复用——若其消息格式固定为 gameId，直接复用；否则新建 `TimelineNotFoundException` 并在 GlobalExceptionHandler 注册（参照现有 NotFound 处理）。

- [ ] **步骤 4：集成测试**

`MatchTimelineControllerIntegrationTest.java`（参照现有 `MatchControllerIntegrationTest` 的 MockMvc 模式）：POST 两次同一 gameId → 均 200 code=0；GET 存在 → 200 且 data 与原样一致；GET 不存在 → 404。

- [ ] **步骤 5：运行测试验证通过**

运行：`mvn test`
预期：全部 PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/main/java/com/leagueakari/dto/TimelineSyncRequest.java src/main/java/com/leagueakari/service/MatchTimelineService.java src/main/java/com/leagueakari/controller/MatchController.java src/test/java/
git commit -m "feat(timeline): 时间线写入/查询接口（幂等 + 404）"
```

---

### 任务 3：列表 DTO 轻量扩展（折叠卡数据）

折叠卡需要：self 的装备/技能/海克斯/符文/多杀 + 双方 10 人基本档案（含每人的装备/技能/海克斯/符文）。在现有 `MatchSummaryResponse` 上扩展，不新增接口。

**文件：**
- 修改：`src/main/java/com/leagueakari/dto/MatchSummaryResponse.java`
- 修改：`src/main/java/com/leagueakari/service/MatchService.java`（`buildSelf` 扩展 + 新增 `buildParticipants`）
- 测试：`src/test/java/com/leagueakari/service/MatchServiceTest.java`

- [ ] **步骤 1：编写失败的测试**

在 `MatchServiceTest.java` 追加（用现有 fixture 构造含 `playerAugment1-6`、`perk0-5`、`perkPrimaryStyle`、`perkSubStyle`、`doubleKills`、`tripleKills`、`item0-6`、`spell1Id/spell2Id` 的 statsJson）：
```java
@Test
void 列表响应包含轻量参与者与self增强字段() {
    // 构造 match + 10 名 participant（含 statsJson fixture）
    // 断言：
    //   resp.getSelf().getItems() 长度 7
    //   resp.getSelf().getAugments() 长度 6
    //   resp.getParticipants().size() == 10
    //   resp.getParticipants().get(0).getPerks().getPerkStyle() == 8100
    //   resp.getSelf().getTripleKills() == 1
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`mvn test -Dtest=MatchServiceTest`
预期：FAIL（编译失败即可，DTO 字段未定义）。

- [ ] **步骤 3：扩展 DTO**

`MatchSummaryResponse.java` 追加：
- `SelfSummary` 增加：`items`（List<Integer>，statsJson 的 item0-6）、`summonerSpells`（List<Integer>，spell1Id/spell2Id）、`augments`（List<Integer>，playerAugment1-6）、`perks`（`ParticipantPerks`）、`doubleKills/tripleKills/quadraKills/pentaKills`（Integer）。
- 新增静态类 `ParticipantPerks`：`perkIds`（List<Integer>，perk0-5）、`perkStyle`（Integer）、`perkSubStyle`（Integer）。
- 新增静态类 `ParticipantLight`：`puuid/summonerName/championId/teamId/position/win/kills/deaths/assists/items/summonerSpells/augments/perks`。
- `MatchSummaryResponse` 增加 `participants`（`List<ParticipantLight>`，10 人全量，含 self）。
- 双源兼容：statsJson 的 `perks` 键若为对象（SGP 嵌套 perks），读取其 `perkIds/perkStyle/perkSubStyle`；否则从平铺 `perk0-5` + `perkPrimaryStyle` + `perkSubStyle` 组装（LCU）——在 service 提取时做双路径探测。

- [ ] **步骤 4：实现 service 提取**

`MatchService.java`：
- 复用现有 `parseStatsJson`/`statInt`/`statBool` 私有方法模式，新增 `statList(JsonNode, String... keys)`（按 item0-6/perk0-5 等连续键名取数组）。
- `buildSelf` 增加上述字段（缺失写 null/0，与现有 placeholder 策略一致）。
- 新增 `buildParticipants(List<MatchParticipant>)` → `List<ParticipantLight>`：10 人遍历，直显列 + statsJson 提取；`self` 行也包含在 participants 中（前端用 puuid 区分）。
- 注意：SGP 透传对象中 `spell1Id/spell2Id` 与 `item0-6` 均在 statsJson 顶层，LCU 同样在 stats 顶层——读取路径统一，无需分支；仅 `perks` 需要双路径探测。

- [ ] **步骤 5：运行测试验证通过**

运行：`mvn test`
预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/main/java/com/leagueakari/dto/MatchSummaryResponse.java src/main/java/com/leagueakari/service/MatchService.java src/test/java/com/leagueakari/service/MatchServiceTest.java
git commit -m "feat(matches): 列表 DTO 扩展轻量参与者与 self 增强字段（折叠卡数据）"
```

---

### 任务 4：验证与契约核对

**文件：** 无新增

- [ ] **步骤 1：全量测试**

运行：`mvn test`
预期：全部 PASS。

- [ ] **步骤 2：手工验证接口**

启动应用后：
```bash
curl -X POST http://localhost:8081/api/matches/12345/timeline -H "Content-Type: application/json" -d '{"gameId":12345,"frames":[{"timestamp":1000}]}'
# 期望 {"code":0}
curl http://localhost:8081/api/matches/12345/timeline
# 期望 {"data":[{"timestamp":1000}]}
curl -X POST http://localhost:8081/api/matches/12345/timeline -H "Content-Type: application/json" -d '{"gameId":12345,"frames":[{"timestamp":999}]}'
# 期望 {"code":0}（幂等，不覆盖）
curl http://localhost:8081/api/matches/999999/timeline
# 期望 404
```

- [ ] **步骤 3：契约核对**

与 web 端 `src/api/matches.ts` 的 `getMatchTimeline`（期望 `{ data: frames[] }`）与 `MatchSummary.participants` 类型对齐；与 Electron 计划（frames 推送体 `{ gameId, frames }`）对齐。

- [ ] **步骤 4：Commit（如有遗留）**

```bash
git add -A
git commit -m "chore: 时间线与列表 DTO 扩展收尾"
```
