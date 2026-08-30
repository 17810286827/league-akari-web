<script setup lang="ts">
/**
 * PROTOTYPE: 战绩页赛博朋克视觉探索。
 * 已确认采用 A / NEON COMMAND，组件保留为正式战绩页视觉布局。
 */
import { ref } from 'vue'

import type { OverviewStats, GameListItem, GameStatsData } from './types'

const props = defineProps<{
  player: { name: string; profileIconId?: number; summonerLevel?: number } | null
  data: GameStatsData
  games: GameListItem[]
  total: number
  loading: boolean
  expandedGameId: number | null
}>()

const emit = defineEmits<{
  search: [value: string]
  refresh: []
  toggle: [gameId: number]
  queueChange: [value: number | null]
}>()

const searchValue = ref('')
const activeVariant = 'A' as const

function submitSearch(): void {
  const value = searchValue.value.trim()
  if (value) emit('search', value)
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}M ${String(seconds % 60).padStart(2, '0')}S`
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function self(game: GameListItem) {
  return game.summary.self
}

function resultClass(game: GameListItem): string {
  return self(game)?.win ? 'is-win' : 'is-loss'
}

function resultLabel(game: GameListItem): string {
  return self(game)?.win ? 'VICTORY' : 'DEFEAT'
}

function score(stats: OverviewStats): string {
  return stats.akariScore === null ? '—' : String(stats.akariScore)
}

</script>

<template>
  <div class="cyber-prototype">
    <div class="noise" aria-hidden="true"></div>
    <header class="cyber-header">
      <div class="brand-lockup">
        <span class="brand-mark">AK</span>
        <div><strong>LEAGUE // AKARI</strong><small>COMBAT RECORDS NETWORK</small></div>
      </div>
      <form class="cyber-search" @submit.prevent="submitSearch">
        <span class="prompt">&gt;_</span>
        <input v-model="searchValue" placeholder="输入召唤师名 #TAG" aria-label="召唤师搜索" />
        <button type="submit" title="查询">SCAN</button>
      </form>
      <button class="icon-button" type="button" title="刷新战绩" @click="emit('refresh')">↻</button>
    </header>

    <main class="command-layout">
      <section class="hero-panel">
        <div class="eyebrow">// ACTIVE SUMMONER / 01</div>
        <div class="hero-row">
          <div class="avatar-frame"><span>{{ player?.name?.slice(0, 2).toUpperCase() || '??' }}</span></div>
          <div class="hero-copy">
            <h1>{{ player?.name || 'UNKNOWN PLAYER' }}</h1>
            <p>LEVEL {{ player?.summonerLevel || '--' }} <i>•</i> PUUID VERIFIED</p>
          </div>
          <div class="rank-readout"><small>RANK STATUS</small><strong>UNRANKED</strong><em>SOLO / FLEX</em></div>
        </div>
        <div class="signal-line"><span>SYNC 98.4%</span><span>REGION CN</span><span>PACKET LIVE</span></div>
      </section>
      <section class="command-grid">
        <aside class="metric-rail">
          <div class="rail-title">COMBAT TELEMETRY</div>
          <div class="metric-main"><small>AKARI SCORE</small><strong>{{ score(data.overview) }}</strong><span>RATING / CURRENT PAGE</span></div>
          <div class="metric-pair"><div><small>WIN RATE</small><b>{{ data.overview.wins }}W</b></div><div><small>KDA</small><b>{{ data.overview.avgKda.toFixed(2) }}</b></div></div>
          <div v-for="item in [['PARTICIPATION', data.overview.participation], ['DAMAGE SHARE', data.overview.damageShare], ['GOLD SHARE', data.overview.goldShare]]" :key="item[0]" class="meter"><span>{{ item[0] }}</span><b>{{ item[1] }}%</b><i><u :style="{ width: `${item[1]}%` }"></u></i></div>
        </aside>
        <section class="feed-panel"><div class="section-heading"><span>RECENT MATCHES</span><small>{{ total }} TOTAL // SORT: NEWEST</small></div><div class="match-stack"><button v-for="game in games" :key="game.summary.gameId" class="match-row" :class="resultClass(game)" type="button" @click="emit('toggle', game.summary.gameId)"><span class="status-block"><b>{{ resultLabel(game) }}</b><small>{{ formatTime(game.summary.gameCreation) }}</small></span><span class="champion-glyph">{{ game.summary.self?.championId || '??' }}</span><span class="match-facts"><b>{{ self(game)?.kills ?? 0 }} / {{ self(game)?.deaths ?? 0 }} / {{ self(game)?.assists ?? 0 }}</b><small>{{ game.summary.gameMode }} // {{ formatDuration(game.summary.gameDuration) }}</small></span><span class="match-score">{{ expandedGameId === game.summary.gameId ? 'OPEN' : 'VIEW ›' }}</span></button><div v-if="loading" class="loading-line">// DOWNLOADING MATCH PACKETS...</div><div v-if="!loading && games.length === 0" class="empty-line">// NO MATCH DATA FOUND</div></div></section>
      </section>
    </main>

    <main v-if="false" class="terminal-layout">
      <aside class="terminal-sidebar"><div class="terminal-id">AKARI_OS <span>v2.6.0</span></div><div class="terminal-player"><div class="mini-avatar">{{ player?.name?.slice(0, 1).toUpperCase() || '?' }}</div><strong>{{ player?.name || 'NO SIGNAL' }}</strong><small>IDENTITY NODE ONLINE</small></div><nav><button class="nav-active" type="button">01 / MATCH LOG</button><button type="button">02 / PERFORMANCE</button><button type="button">03 / DUO INDEX</button></nav><div class="terminal-note">[ STATUS ]<br /><em>ALL SYSTEMS NOMINAL</em><br /><br />LAST SYNC<br />{{ new Date().toLocaleDateString() }}</div></aside>
      <section class="terminal-main"><div class="terminal-title"><div><small>PLAYER DOSSIER / {{ player?.name || 'UNKNOWN' }}</small><h1>MATCH LOG<span>_</span></h1></div><div class="big-stat"><small>W / L</small><strong>{{ data.overview.wins }}<i>/</i>{{ data.overview.losses }}</strong></div></div><div class="terminal-stats"><div><small>AVG KDA</small><b>{{ data.overview.avgKda.toFixed(2) }}</b></div><div><small>CS / MIN</small><b>{{ data.overview.csPerMin.toFixed(1) }}</b></div><div><small>PARTICIPATION</small><b>{{ data.overview.participation }}%</b></div><div><small>SCORE</small><b>{{ score(data.overview) }}</b></div></div><div class="log-table"><div class="log-head"><span>OUTCOME</span><span>GAME ID</span><span>MODE</span><span>KDA</span><span>TIME</span></div><button v-for="game in games" :key="game.summary.gameId" type="button" class="log-item" :class="resultClass(game)" @click="emit('toggle', game.summary.gameId)"><span><i></i>{{ resultLabel(game) }}</span><span>#{{ game.summary.gameId }}</span><span>{{ game.summary.gameMode }}</span><span>{{ self(game)?.kills ?? 0 }} / {{ self(game)?.deaths ?? 0 }} / {{ self(game)?.assists ?? 0 }}</span><span>{{ formatDuration(game.summary.gameDuration) }}</span></button></div></section>
    </main>

    <main v-if="false" class="battle-layout">
      <section class="battle-intro"><small>OPERATION // PLAYER HISTORY</small><h1>{{ player?.name || 'UNKNOWN' }}<br /><span>COMBAT FEED</span></h1><p>TACTICAL READOUT OF RECENT ENGAGEMENTS</p><div class="scan-cta">SCROLL TO DECRYPT <b>↓</b></div></section><section class="battle-feed"><article v-for="(game, index) in games" :key="game.summary.gameId" class="battle-card" :class="resultClass(game)"><div class="card-index">0{{ index + 1 }}</div><div class="card-outcome"><span>{{ resultLabel(game) }}</span><small>{{ formatTime(game.summary.gameCreation) }}</small></div><div class="card-core"><h2>{{ game.summary.gameMode }} <small>// GAME {{ game.summary.gameId }}</small></h2><div class="kda-line"><strong>{{ self(game)?.kills ?? 0 }}</strong><i>/</i><strong>{{ self(game)?.deaths ?? 0 }}</strong><i>/</i><strong>{{ self(game)?.assists ?? 0 }}</strong></div><p>{{ formatDuration(game.summary.gameDuration) }} <span>•</span> QUEUE {{ game.summary.queueId }}</p></div><button type="button" class="detail-trigger" @click="emit('toggle', game.summary.gameId)">{{ expandedGameId === game.summary.gameId ? 'CLOSE' : 'DETAILS' }}</button></article><div v-if="!loading && games.length === 0" class="empty-line">// FEED EMPTY</div></section><aside class="battle-aside"><div><small>PAGE WIN RATE</small><strong>{{ data.overview.wins + data.overview.losses ? Math.round(data.overview.wins / (data.overview.wins + data.overview.losses) * 100) : 0 }}%</strong></div><div><small>AVG DAMAGE</small><strong>{{ data.overview.damageShare }}%</strong></div><div><small>QUEUE</small><strong>ALL</strong></div></aside></main>
  </div>
</template>

<style lang="scss" scoped>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap');
.cyber-prototype { --ink:#06080d; --panel:#0b111a; --panel-2:#111b28; --cyan:#27f4ff; --pink:#ff3cac; --acid:#d8ff3e; --muted:#72849c; min-height:100vh; color:#e9f8ff; background:radial-gradient(circle at 85% 8%,#17284c 0,transparent 30%),radial-gradient(circle at 10% 85%,#2a102b 0,transparent 28%),var(--ink); font-family:'Space Mono',Consolas,monospace; position:relative; overflow:hidden; }
.cyber-prototype::before { content:''; pointer-events:none; position:absolute; inset:0; opacity:.1; background-image:linear-gradient(rgba(39,244,255,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(39,244,255,.25) 1px,transparent 1px); background-size:42px 42px; mask-image:linear-gradient(to bottom,black,transparent 85%); }
.noise { position:absolute; inset:0; pointer-events:none; opacity:.035; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E"); }
.cyber-header { height:78px; display:flex; align-items:center; gap:28px; padding:0 clamp(18px,4vw,64px); border-bottom:1px solid #23334a; background:rgba(6,8,13,.86); position:relative; z-index:2; }
.brand-lockup { display:flex; align-items:center; gap:12px; min-width:260px; font-family:Orbitron,sans-serif; }.brand-mark { color:var(--cyan); border:1px solid var(--cyan); padding:8px 6px; box-shadow:4px 4px 0 var(--pink); font-weight:800; }.brand-lockup strong,.brand-lockup small { display:block; }.brand-lockup strong { font-size:13px; letter-spacing:1.8px; }.brand-lockup small { color:var(--muted); font-size:8px; margin-top:4px; letter-spacing:1px; }
.cyber-search { display:flex; align-items:center; flex:1; max-width:620px; height:36px; border:1px solid #2d4b64; background:#09101a; }.prompt { color:var(--pink); padding:0 10px; }.cyber-search input { flex:1; color:var(--cyan); background:transparent; border:0; outline:0; font:12px 'Space Mono'; }.cyber-search button,.icon-button { color:var(--ink); background:var(--cyan); border:0; font:700 11px 'Space Mono'; height:100%; padding:0 16px; cursor:pointer; }.icon-button { margin-left:auto; width:36px; padding:0; font-size:22px; box-shadow:3px 3px 0 var(--pink); }
.command-layout,.terminal-layout,.battle-layout { max-width:1440px; margin:0 auto; padding:44px clamp(18px,4vw,64px) 110px; position:relative; z-index:1; }.eyebrow,.section-heading,.rail-title,.terminal-id,.terminal-title small,.battle-intro small { color:var(--cyan); letter-spacing:2px; font-size:10px; }.hero-panel { border:1px solid #2a4260; padding:24px; background:linear-gradient(120deg,rgba(17,27,40,.95),rgba(10,17,27,.72)); clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,0 100%); }.hero-row { display:flex; align-items:center; gap:22px; margin:24px 0 18px; }.avatar-frame { width:88px; height:88px; display:grid; place-items:center; color:var(--pink); font:800 28px Orbitron; border:2px solid var(--pink); box-shadow:8px 8px 0 rgba(255,60,172,.18),inset 0 0 24px rgba(255,60,172,.2); }.hero-copy h1 { font:700 clamp(24px,4vw,46px) Orbitron; margin:0; letter-spacing:2px; }.hero-copy p,.rank-readout small,.rank-readout em { color:var(--muted); font-size:10px; letter-spacing:1px; }.hero-copy i { color:var(--pink); font-style:normal; }.rank-readout { margin-left:auto; text-align:right; display:grid; gap:6px; }.rank-readout strong { color:var(--acid); font:600 18px Orbitron; }.rank-readout em { font-style:normal; }.signal-line { border-top:1px solid #25405b; padding-top:12px; display:flex; gap:28px; color:var(--muted); font-size:9px; }.signal-line span:first-child { color:var(--acid); }.command-grid { display:grid; grid-template-columns:270px 1fr; gap:18px; margin-top:18px; }.metric-rail,.feed-panel { border:1px solid #263950; background:rgba(11,17,26,.85); padding:20px; }.metric-main { padding:30px 0 24px; border-bottom:1px solid #263950; }.metric-main small,.metric-pair small,.meter span { display:block; color:var(--muted); font-size:9px; letter-spacing:1px; }.metric-main strong { display:block; color:var(--acid); font:700 46px Orbitron; margin:12px 0 6px; }.metric-main span { color:var(--pink); font-size:8px; }.metric-pair { display:grid; grid-template-columns:1fr 1fr; padding:20px 0; border-bottom:1px solid #263950; }.metric-pair b { color:#fff; font:600 21px Orbitron; display:block; margin-top:8px; }.meter { margin-top:20px; }.meter b { float:right; color:var(--cyan); font-size:10px; }.meter i { display:block; height:3px; background:#1c2a3c; margin-top:8px; }.meter u { display:block; height:100%; background:linear-gradient(90deg,var(--pink),var(--cyan)); text-decoration:none; }.section-heading { display:flex; justify-content:space-between; border-bottom:1px solid #263950; padding-bottom:15px; }.section-heading small { color:var(--muted); font-size:9px; }.match-stack { padding-top:10px; }.match-row { width:100%; display:grid; grid-template-columns:125px 48px 1fr 70px; align-items:center; gap:12px; text-align:left; color:#e9f8ff; background:transparent; border:0; border-bottom:1px solid #1b293b; padding:15px 8px; cursor:pointer; font-family:inherit; }.match-row:hover { background:#142134; }.match-row.is-win { border-left:3px solid var(--cyan); }.match-row.is-loss { border-left:3px solid var(--pink); }.status-block b,.status-block small,.match-facts b,.match-facts small { display:block; }.status-block b { font-size:10px; color:var(--cyan); }.is-loss .status-block b { color:var(--pink); }.status-block small,.match-facts small { color:var(--muted); font-size:9px; margin-top:5px; }.champion-glyph { color:var(--acid); font-size:10px; border:1px solid #4c5c37; padding:9px 4px; text-align:center; }.match-facts b { font-size:13px; }.match-score { color:var(--acid); font-size:9px; text-align:right; }.loading-line,.empty-line { color:var(--pink); padding:24px 8px; font-size:10px; }
.terminal-layout { display:grid; grid-template-columns:230px 1fr; gap:36px; min-height:calc(100vh - 78px); }.terminal-sidebar { border-right:1px solid #293c52; padding:5px 28px 0 0; }.terminal-id { color:var(--acid); font-size:12px; }.terminal-id span { color:var(--muted); float:right; font-size:9px; }.terminal-player { margin:64px 0; padding-left:14px; border-left:2px solid var(--pink); display:grid; gap:10px; }.mini-avatar { color:var(--cyan); border:1px solid var(--cyan); width:42px; height:42px; display:grid; place-items:center; font:700 20px Orbitron; }.terminal-player strong { font:600 14px Orbitron; overflow:hidden; text-overflow:ellipsis; }.terminal-player small,.terminal-note { color:var(--muted); font-size:9px; line-height:1.8; }.terminal-sidebar nav { display:grid; gap:14px; }.terminal-sidebar nav button { text-align:left; color:var(--muted); background:transparent; border:0; padding:8px 0; font:10px 'Space Mono'; cursor:pointer; }.terminal-sidebar nav .nav-active { color:var(--cyan); }.terminal-note { margin-top:70px; }.terminal-note em { color:var(--acid); font-style:normal; }.terminal-title { display:flex; justify-content:space-between; align-items:end; border-bottom:1px solid #293c52; padding-bottom:26px; }.terminal-title h1 { font:700 clamp(28px,5vw,64px) Orbitron; margin:12px 0 0; }.terminal-title h1 span { color:var(--pink); }.big-stat { text-align:right; }.big-stat small { display:block; color:var(--muted); font-size:9px; }.big-stat strong { color:var(--acid); font:700 34px Orbitron; }.big-stat i { color:var(--pink); font-style:normal; padding:0 6px; }.terminal-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:#293c52; margin:24px 0; }.terminal-stats div { background:#0b111a; padding:18px; }.terminal-stats small { color:var(--muted); font-size:9px; }.terminal-stats b { display:block; color:var(--cyan); font:600 22px Orbitron; margin-top:9px; }.log-table { border-top:2px solid var(--cyan); }.log-head,.log-item { display:grid; grid-template-columns:1.4fr 1.2fr 1fr 1fr 1fr; gap:14px; align-items:center; }.log-head { color:var(--muted); font-size:9px; padding:14px 16px; }.log-item { width:100%; text-align:left; color:#dce8f0; background:rgba(17,27,40,.72); border:0; border-top:1px solid #1c2b3d; padding:18px 16px; font:10px 'Space Mono'; cursor:pointer; }.log-item:hover { background:#172539; }.log-item > span:first-child { color:var(--cyan); }.log-item.is-loss > span:first-child { color:var(--pink); }.log-item i { display:inline-block; width:7px; height:7px; background:currentColor; margin-right:8px; }.log-item span:not(:first-child) { color:var(--muted); }
.battle-layout { display:grid; grid-template-columns:minmax(250px,.75fr) minmax(400px,1.5fr) 150px; gap:40px; align-items:start; }.battle-intro { position:sticky; top:30px; padding-top:70px; }.battle-intro h1 { font:700 clamp(30px,4vw,58px) Orbitron; line-height:1.15; margin:22px 0; }.battle-intro h1 span { color:var(--pink); text-shadow:4px 4px 0 rgba(39,244,255,.22); }.battle-intro p { color:var(--muted); font-size:10px; letter-spacing:1px; }.scan-cta { margin-top:90px; color:var(--cyan); font-size:10px; }.scan-cta b { color:var(--pink); font-size:20px; margin-left:10px; }.battle-feed { border-left:1px solid #293c52; border-right:1px solid #293c52; padding:0 24px; }.battle-card { display:grid; grid-template-columns:42px 105px 1fr 72px; align-items:center; min-height:150px; border-bottom:1px solid #293c52; gap:14px; position:relative; }.battle-card::before { content:''; position:absolute; left:-25px; width:3px; height:45px; background:var(--cyan); }.battle-card.is-loss::before { background:var(--pink); }.card-index { color:#40536a; font:700 18px Orbitron; }.card-outcome span,.card-outcome small { display:block; }.card-outcome span { color:var(--cyan); font-size:10px; }.is-loss .card-outcome span { color:var(--pink); }.card-outcome small,.card-core p { color:var(--muted); font-size:9px; margin-top:8px; }.card-core h2 { font:600 16px Orbitron; margin:0; }.card-core h2 small { color:var(--muted); font:9px 'Space Mono'; }.kda-line { margin-top:14px; color:var(--acid); font:600 23px Orbitron; }.kda-line i { color:var(--pink); font-size:14px; font-style:normal; padding:0 5px; }.card-core p span { color:var(--pink); padding:0 5px; }.detail-trigger { color:var(--cyan); border:1px solid #33536e; background:transparent; padding:9px 4px; font:9px 'Space Mono'; cursor:pointer; }.detail-trigger:hover { background:var(--cyan); color:var(--ink); }.battle-aside { position:sticky; top:30px; display:grid; gap:28px; }.battle-aside div { border-top:2px solid var(--pink); padding-top:10px; }.battle-aside small { display:block; color:var(--muted); font-size:8px; }.battle-aside strong { color:var(--acid); display:block; font:600 25px Orbitron; margin-top:8px; }
.prototype-switcher { position:fixed; left:50%; bottom:22px; transform:translateX(-50%); z-index:10; display:flex; align-items:center; gap:16px; color:var(--ink); background:var(--cyan); padding:8px 12px; box-shadow:6px 6px 0 var(--pink); font-size:10px; }.prototype-switcher button { color:var(--ink); border:0; background:transparent; cursor:pointer; font-size:24px; line-height:16px; }.prototype-switcher span { min-width:190px; text-align:center; }.prototype-switcher b { background:var(--ink); color:var(--cyan); padding:3px 6px; margin-right:6px; }.prototype-badge { position:fixed; right:16px; bottom:16px; z-index:9; color:#486177; font-size:8px; letter-spacing:1px; }
@media (max-width:900px) { .cyber-header { gap:12px; }.brand-lockup { min-width:0; }.brand-lockup strong { font-size:10px; }.brand-lockup small { display:none; }.command-grid,.terminal-layout,.battle-layout { grid-template-columns:1fr; }.metric-rail { display:none; }.terminal-sidebar { border-right:0; border-bottom:1px solid #293c52; padding:0 0 18px; }.terminal-player { margin:24px 0; }.terminal-note,.terminal-sidebar nav { display:none; }.battle-intro { position:static; padding-top:0; }.battle-aside { display:flex; position:static; }.battle-feed { border-left:0; border-right:0; padding:0; }.battle-card::before { left:-1px; }.cyber-search { max-width:none; }.hero-row { align-items:flex-start; }.rank-readout { display:none; } }
@media (max-width:560px) { .cyber-header { height:auto; padding:14px 18px; flex-wrap:wrap; }.cyber-search { order:3; flex-basis:100%; }.hero-panel { padding:16px; }.hero-row { gap:12px; }.avatar-frame { width:58px; height:58px; font-size:18px; }.hero-copy h1 { font-size:20px; }.match-row { grid-template-columns:88px 36px 1fr; }.match-score { display:none; }.terminal-stats { grid-template-columns:1fr 1fr; }.log-head,.log-item { grid-template-columns:1.2fr 1fr 1fr; }.log-head span:nth-child(2),.log-head span:nth-child(5),.log-item span:nth-child(2),.log-item span:nth-child(5) { display:none; }.battle-card { grid-template-columns:30px 74px 1fr; }.detail-trigger { grid-column:3; justify-self:start; }.prototype-switcher span { min-width:140px; } }
</style>
