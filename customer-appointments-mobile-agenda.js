"use strict";

const styles = String.raw`
.apptMobileAgendaV454,.apptMobilePanelV455{display:none;--white:#fff;--slate-50:#F8FAFC;--slate-400:#94A3B8;--slate-600:#475569;--cyan-50:#F3FBFF;--cyan-200:#BAE6FD;--cyan-700:#0369A1;--border-subtle:#DCE5F1;--border-default:#CBD5E1;--radius-md:16px;--radius-lg:20px;--shadow-xs:0 2px 8px rgba(5,18,42,.05);--shadow-sm:0 8px 22px rgba(5,18,42,.08);--shadow-glow:0 10px 24px rgba(18,168,244,.24);--gradient-cyan:linear-gradient(135deg,#25BFFF,#078DCE)}
@media(max-width:760px){
  #appointmentApp.apptMobileAgendaActive>#apptIntegrationGate,
  #appointmentApp.apptMobileAgendaActive>#apptAgendaHero,
  #appointmentApp.apptMobileAgendaActive>#apptAgendaToolbar,
  #appointmentApp.apptMobileAgendaActive>#apptAgendaLegend,
  #appointmentApp.apptMobileAgendaActive>#apptWeekView,
  #appointmentApp.apptMobileAgendaActive>#apptMonthView,
  #appointmentApp.apptMobileAgendaActive>#apptYearView,
  #appointmentApp.apptMobileAgendaActive>#apptInboxView{display:none!important}
  #appointmentApp.apptMobilePanelActiveV455>#apptMobilePanelView,
  #appointmentApp.apptMobilePanelActiveV455>#apptIntegrationGate{display:none!important}
  .apptMobilePanelV455{display:grid;gap:14px;width:100%;min-width:0;overflow-x:hidden;padding-bottom:6px;color:var(--navy-900)}
  .apptMobilePanelV455[hidden]{display:none!important}
  .amPanelGreeting{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .amPanelGreeting h2{font-family:var(--font-display);font-size:20px;font-weight:800;letter-spacing:-.03em}
  .amPanelGreeting p{margin-top:3px;color:var(--slate-500);font-size:12.5px;text-transform:capitalize}
  .amPanelPill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--cyan-200);border-radius:999px;background:var(--cyan-50);padding:8px 11px;color:var(--cyan-700);font-size:11.5px;font-weight:800;white-space:nowrap}
  .amPanelPill svg{width:14px;height:14px}
  .amNextHero{position:relative;overflow:hidden;border-radius:22px;background:linear-gradient(150deg,#122c59,#06132c);padding:18px;color:#fff;box-shadow:0 14px 28px rgba(6,19,44,.14)}
  .amNextHero:after{content:"";position:absolute;top:-54px;right:-42px;width:170px;height:170px;border-radius:50%;background:radial-gradient(circle,rgba(0,160,240,.34),transparent 70%);pointer-events:none}
  .amNextHero>*{position:relative;z-index:1}
  .amNextHero small{display:block;color:var(--cyan-400);font-size:10.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
  .amNextTime{display:flex;align-items:baseline;gap:9px;margin-top:9px}
  .amNextTime strong{font-family:var(--font-display);font-size:28px;font-weight:800;letter-spacing:-.035em}
  .amNextTime span{color:rgba(255,255,255,.72);font-size:13px}
  .amNextHero h3{margin-top:7px;color:#fff;font-size:15.5px;font-weight:800;line-height:1.3}
  .amNextHero p{margin-top:3px;color:rgba(255,255,255,.72);font-size:13px}
  .amNextHero button{min-height:42px;display:inline-flex;align-items:center;gap:8px;margin-top:14px;border:0;border-radius:13px;background:var(--gradient-cyan);padding:0 17px;color:#fff;font:800 13px/1 var(--font-body);box-shadow:var(--shadow-glow)}
  .amNextHero.empty h3{margin-top:10px}.amNextHero.empty p{max-width:260px;line-height:1.45}
  .amPanelOverline{margin:0 2px -5px;color:var(--slate-400);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
  .amPanelStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
  .amPanelStat{min-width:0;min-height:98px;border:1px solid var(--border-subtle);border-radius:var(--radius-md);background:#fff;padding:13px 10px;box-shadow:var(--shadow-xs)}
  .amPanelStat strong{display:block;font-family:var(--font-display);font-size:22px;font-weight:800;letter-spacing:-.03em}
  .amPanelStat span{display:block;margin-top:4px;color:var(--slate-500);font-size:11px;line-height:1.3}
  .amPanelStat small{display:block;margin-top:5px;color:#14A971;font-size:10.5px;font-weight:800}
  .amPanelStat:nth-child(2) small{color:var(--cyan-700)}
  .amReminderLink{width:100%;min-height:78px;display:grid;grid-template-columns:40px minmax(0,1fr) 20px;align-items:center;gap:12px;border:1px solid var(--border-subtle);border-radius:var(--radius-lg);background:#fff;padding:14px 16px;text-align:left;box-shadow:var(--shadow-xs)}
  .amReminderIcon{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:var(--cyan-50);color:var(--cyan-700)}
  .amReminderIcon svg{width:20px;height:20px}
  .amReminderCopy strong{display:block;color:var(--navy-900);font-size:15px;font-weight:800}
  .amReminderCopy span{display:block;overflow:hidden;margin-top:3px;color:var(--slate-500);font-size:12.5px;text-overflow:ellipsis;white-space:nowrap}
  .amReminderArrow{color:var(--slate-300);font-size:24px}
  .apptMobileAgendaV454{display:grid;gap:12px;width:100%;min-width:0;overflow-x:hidden;padding-bottom:6px;color:var(--navy-900)}
  .apptMobileAgendaV454[hidden]{display:none!important}
  .amAgendaHead{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:-1px}
  .amAgendaHead h2{font-family:var(--font-display);font-size:20px;font-weight:800;letter-spacing:-.03em}
  .amAgendaHead span{color:var(--slate-500);font-size:12px;font-weight:700;white-space:nowrap}
  .amViewSwitch{display:flex;gap:4px;padding:4px;border:1px solid var(--border-subtle);border-radius:999px;background:var(--slate-100)}
  .amViewSwitch button{min-width:0;height:44px;flex:1;border:0;border-radius:999px;background:transparent;color:var(--slate-500);font:800 12.5px/1 var(--font-body);touch-action:manipulation}
  .amViewSwitch button.active{background:var(--white);color:var(--navy-900);box-shadow:inset 0 0 0 2px #057BB6,var(--shadow-xs)}
  .amGuide{border-radius:var(--radius-lg);background:linear-gradient(135deg,#0B1E44,#0A1730);padding:14px 15px 13px;color:#fff}
  .amGuideTop{display:grid;grid-template-columns:28px minmax(0,1fr);gap:11px;align-items:start}
  .amGuideIcon{width:28px;height:28px;display:grid;place-items:center;border-radius:9px;background:rgba(0,160,240,.16);color:var(--cyan-400);font-size:15px}
  .amGuide small{display:block;color:var(--cyan-400);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
  .amGuide strong{display:block;margin-top:3px;color:#fff;font-size:13.5px;font-weight:700;line-height:1.4;text-wrap:pretty}
  .amGuidePlan{display:flex;gap:8px;margin-top:11px;padding-top:11px;border-top:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.72);font-size:12.5px;line-height:1.45;text-wrap:pretty}
  .amGuidePlan i{color:var(--cyan-400);font-style:normal}
  .amGuide button{width:100%;min-height:44px;margin-top:11px;border:0;border-radius:12px;background:var(--gradient-cyan);color:#fff;font:800 12.5px/1 var(--font-body);box-shadow:var(--shadow-glow)}
  .amView{min-width:0;animation:amRise .3s var(--ease-out)}
  .amOverline{margin:0 2px 9px;color:var(--slate-400);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
  .amListSection+.amListSection{margin-top:18px}
  .amListCards{display:grid;gap:9px}
  .amListCard{width:100%;min-height:70px;display:grid;grid-template-columns:52px minmax(0,1fr) auto;align-items:center;gap:12px;border:1px solid var(--border-subtle);border-left:4px solid var(--am-accent);border-radius:var(--radius-md);background:var(--white);padding:13px 15px;text-align:left;box-shadow:var(--shadow-xs);touch-action:manipulation}
  .amListCard.tomorrow{grid-template-columns:52px minmax(0,1fr);opacity:.92}
  .amListTime strong{display:block;font-family:var(--font-display);font-size:15px;font-weight:800;white-space:nowrap}
  .amListTime small{display:block;margin-top:3px;color:var(--slate-400);font-size:11px}
  .amListInfo{min-width:0}
  .amListInfo strong{display:block;overflow:hidden;color:var(--navy-900);font-size:14px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
  .amListInfo span{display:block;overflow:hidden;margin-top:4px;color:var(--slate-500);font-size:12.5px;text-overflow:ellipsis;white-space:nowrap}
  .amStatus{align-self:center;border-radius:999px;padding:4px 9px;font-size:10.5px;font-weight:800;white-space:nowrap}
  .amEmpty{border:1px dashed var(--border-default);border-radius:var(--radius-lg);background:var(--white);padding:22px 18px;text-align:center}
  .amEmpty strong{display:block;font-size:14px}
  .amEmpty p{margin-top:5px;color:var(--slate-500);font-size:12.5px;line-height:1.5}
  .amPeriodNav{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:8px;margin-bottom:11px}
  .amPeriodNav button{width:44px;height:44px;border:1px solid var(--border-subtle);border-radius:13px;background:#fff;color:var(--slate-500);font-size:22px}
  .amPeriodNav strong{text-align:center;font-size:12.5px;font-weight:800}
  .amWeekDays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;margin-bottom:16px}
  .amDayChip{min-width:0;min-height:56px;display:flex;flex-direction:column;align-items:center;gap:4px;border:1px solid var(--border-subtle);border-radius:14px;background:#fff;padding:8px 0 7px;color:var(--navy-900)}
  .amDayChip.today{border-color:var(--cyan-200);background:var(--cyan-50);color:var(--cyan-700)}
  .amDayChip.selected{border-color:transparent;background:var(--navy-900);color:#fff;box-shadow:var(--shadow-sm)}
  .amDayChip small{color:var(--slate-400);font-size:10px;font-weight:800}
  .amDayChip.selected small{color:rgba(255,255,255,.65)}
  .amDayChip strong{font-family:var(--font-display);font-size:15px;font-weight:800;line-height:1}
  .amDots{height:5px;display:flex;gap:2px;justify-content:center}
  .amDots i{width:4.5px;height:4.5px;border-radius:50%;background:var(--dot);font-style:normal}
  .amDayMeta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 2px 10px}
  .amDayMeta strong{color:var(--slate-400);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
  .amDayMeta span{color:var(--slate-400);font-size:11.5px;text-align:right}
  .amTimeline{position:relative;min-height:78px}
  .amHour{position:absolute;left:0;right:0;display:flex;align-items:center;gap:8px}
  .amHour span{width:40px;color:var(--slate-400);font:10px/1 var(--font-mono);text-align:right}
  .amHour i{height:1px;flex:1;background:var(--slate-100)}
  .amNow{position:absolute;left:44px;right:0;height:2px;border-radius:2px;background:var(--cyan-500);box-shadow:0 0 0 3px rgba(0,160,240,.12)}
  .amTimelineCard{position:absolute;left:48px;right:0;min-height:82px;overflow:hidden;border:1px solid var(--border-subtle);border-left:3px solid var(--am-accent);border-radius:13px;background:#fff;padding:9px 11px;text-align:left;box-shadow:var(--shadow-xs)}
  .amTimelineTop{display:flex;align-items:center;justify-content:space-between;gap:7px}
  .amTimelineTop>span{color:var(--slate-500);font:700 10.5px/1 var(--font-mono)}
  .amTimelineCard h4{overflow:hidden;margin-top:4px;color:var(--navy-900);font-size:13px;font-weight:700;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}
  .amTimelineCard p{overflow:hidden;margin-top:3px;color:var(--slate-500);font-size:11.5px;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}
  .amMonthCard{overflow:hidden;border:1px solid var(--border-subtle);border-radius:var(--radius-lg);background:#fff;box-shadow:var(--shadow-xs)}
  .amMonthHead,.amMonthGrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
  .amMonthHead{border-bottom:1px solid var(--border-subtle);background:var(--slate-50)}
  .amMonthHead span{padding:7px 0;color:var(--slate-400);font-size:9.5px;font-weight:800;text-align:center}
  .amMonthCell{min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;gap:5px;border:0;border-right:1px solid var(--slate-100);border-bottom:1px solid var(--slate-100);background:#fff;padding:7px 0 6px}
  .amMonthCell.outside{background:#FAFBFD;color:var(--slate-300)}
  .amMonthCell:disabled{cursor:default}
  .amMonthNumber{min-width:21px;height:21px;display:inline-flex;align-items:center;justify-content:center;border-radius:99px;color:var(--navy-900);font-size:12px;font-weight:700}
  .amMonthCell.outside .amMonthNumber{color:var(--slate-300);font-weight:500}
  .amMonthCell.today .amMonthNumber{background:var(--navy-900);color:#fff;font-weight:800}
  .amMonthLegend{display:flex;flex-wrap:wrap;gap:12px;margin:12px 4px 0;color:var(--slate-500);font-size:11px}
  .amMonthLegend span{display:flex;align-items:center;gap:5px}
  .amMonthLegend i{width:6px;height:6px;border-radius:50%;background:var(--dot)}
  .amMonthHint{margin:10px 4px 0;color:var(--slate-400);font-size:12px}
  .amSheet{position:fixed;inset:0;z-index:125;display:flex;align-items:flex-end;background:rgba(6,15,34,.55);backdrop-filter:blur(4px);animation:amFade .2s ease}
  .amSheet[hidden]{display:none!important}
  .amSheetScrim{position:absolute;inset:0;border:0;background:transparent}
  .amSheetPanel{position:relative;width:100%;max-height:88dvh;overflow-y:auto;border-radius:24px 24px 0 0;background:var(--slate-50);padding:10px 16px calc(20px + env(safe-area-inset-bottom));animation:amSheetIn .3s var(--ease-out)}
  .amSheetHandle{width:40px;height:4px;margin:2px auto 12px;border-radius:99px;background:var(--slate-300)}
  .amSheetHead{display:grid;grid-template-columns:minmax(0,1fr) 32px;gap:10px;align-items:start}
  .amSheetHead h3{margin-top:8px;font-family:var(--font-display);font-size:19px;font-weight:800;line-height:1.2}
  .amSheetHead p{margin-top:4px;color:var(--slate-500);font-size:13px}
  .amSheetClose{width:32px;height:32px;border:0;border-radius:10px;background:var(--slate-100);color:var(--slate-600);font-size:18px}
  .amSheetChips{display:flex;gap:7px;overflow:hidden;margin-top:13px}
  .amSheetChips span{min-width:0;height:30px;display:flex;align-items:center;gap:5px;overflow:hidden;border:1px solid var(--border-subtle);border-radius:999px;background:#fff;padding:0 10px;color:var(--navy-900);font-size:12px;font-weight:700;white-space:nowrap;text-overflow:ellipsis}
  .amWhere{margin-top:13px;border:1.5px solid var(--cyan-200);border-radius:var(--radius-lg);background:#fff;padding:15px 16px;box-shadow:var(--shadow-xs)}
  .amWhere>small{display:block;color:var(--cyan-700);font-size:11px;font-weight:800;letter-spacing:.12em}
  .amWhere h4{margin-top:9px;font-size:14px;font-weight:700}
  .amMeetingUrl{overflow:hidden;margin-top:9px;border:1px solid var(--border-subtle);border-radius:10px;background:var(--slate-50);padding:9px 11px;color:var(--navy-900);font:11.5px/1.35 var(--font-mono);text-overflow:ellipsis;white-space:nowrap}
  .amWhereActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
  .amWhereActions a,.amWhereActions button{min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:11px;font-size:12.5px;font-weight:800;text-decoration:none}
  .amWhereActions .primary{border:0;background:var(--gradient-cyan);color:#fff;box-shadow:var(--shadow-glow)}
  .amWhereActions .secondary{border:1.5px solid var(--border-default);background:#fff;color:var(--navy-900)}
  .amWhereNote{margin-top:9px;color:var(--slate-400);font-size:11.5px;line-height:1.45}
  .amReplaceLink{min-height:44px;margin-top:3px;border:0;background:transparent;color:var(--slate-500);font-size:11.5px;font-weight:800;text-decoration:underline}
  .amMeetingEdit{display:grid;gap:8px;margin-top:10px}
  .amMeetingEdit[hidden]{display:none!important}
  .amMeetingEdit textarea{width:100%;height:46px;min-height:46px;max-height:46px;resize:none;overflow:hidden;border:1px solid var(--border-default);border-radius:11px;background:#fff;padding:12px;color:var(--navy-900);font:12px/20px var(--font-mono)}
  .amMeetingEdit button{min-height:44px;border:0;border-radius:11px;background:var(--navy-900);color:#fff;font-size:12px;font-weight:800}
  .amNeedsLink{margin-top:8px;color:#9A6406;font-size:12px;line-height:1.45}
  .amOnlyStep{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;margin-top:12px;border:1px solid var(--border-subtle);border-radius:var(--radius-md);background:#fff;padding:12px 14px}
  .amOnlyStep>i{width:22px;height:22px;display:grid;place-items:center;border-radius:7px;background:var(--cyan-50);color:var(--cyan-700);font-style:normal}
  .amOnlyStep small{display:block;color:var(--slate-400);font-size:10px;font-weight:800;letter-spacing:.1em}
  .amOnlyStep p{margin-top:4px;color:var(--navy-900);font-size:12.5px;line-height:1.45}
  .amSheetFooter{display:grid;grid-template-columns:1fr 1.15fr;gap:8px;margin-top:13px}
  .amSheetFooter button{min-height:46px;border-radius:12px;font-size:12.5px;font-weight:800}
  .amSheetFooter .secondary{border:1.5px solid var(--border-default);background:#fff;color:var(--navy-900)}
  .amSheetFooter .primary{border:0;background:var(--navy-900);color:#fff}
  .amAgendaLoadError{border:1px solid #F5D18B;border-radius:var(--radius-lg);background:#FFF9EB;padding:16px;color:#5E430D}
  .amAgendaLoadError p{font-size:12.5px;line-height:1.5}
  .amAgendaLoadError button{min-height:44px;margin-top:10px;border:0;border-radius:11px;background:var(--navy-900);color:#fff;padding:0 14px;font-weight:800}
  /* The reminders module uses a desktop grid above.  Reset its intrinsic
     widths on phones so copy wraps inside the panel instead of widening it. */
  #appointmentApp{grid-template-columns:minmax(0,1fr)}
  #apptRemindersView,#apptRemindersView>*{width:100%;min-width:0;max-width:100%;box-sizing:border-box}
  .remHeroV3{min-width:0;padding:22px 16px}
  .remHeroEyebrow{font-size:10px;letter-spacing:.1em}
  .remHeroV3 h3{margin-top:14px;font-size:24px;line-height:1.13;overflow-wrap:anywhere}
  .remHeroV3>p{margin-top:12px;font-size:13px;line-height:1.45;overflow-wrap:anywhere}
  .remFlow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;overflow:visible;margin-top:17px}
  .remFlow>span{min-width:0;min-height:48px;justify-content:center;gap:4px;padding:7px 5px;font-size:10px;line-height:1.1;text-align:center;white-space:normal}
  .remFlow>span svg{width:16px;height:16px;flex:0 0 auto}
  .remFlow>i{display:none}
  .remHeroMetrics{gap:5px;margin-top:18px;padding-top:17px}
  .remHeroMetrics span{min-width:0;font-size:9px;line-height:1.25;overflow-wrap:anywhere}
  .remHeroMetrics strong{font-size:22px}
  .remAttention{min-width:0;grid-template-columns:42px minmax(0,1fr);gap:11px;padding:14px}
  .remAttentionCopy{min-width:0}.remAttentionCopy small,.remAttentionCopy strong,.remAttentionCopy p{overflow-wrap:anywhere}
  .remAttention .apptPrimary{grid-column:1/-1;min-width:0;box-sizing:border-box}
  .remTodayHead{min-width:0;gap:8px}.remTodayHead span{min-width:0;text-align:right;font-size:11px;overflow-wrap:anywhere}
  .remSection,.remCards,.remCardV3,.remCardTop,.remCardBottom{min-width:0;max-width:100%;box-sizing:border-box}
  .apptMobileAgendaActive~* .mobileBottomNav{z-index:60}
  .amViewSwitch button:focus-visible,.amListCard:focus-visible,.amDayChip:focus-visible,.amTimelineCard:focus-visible,.amMonthCell:focus-visible,.amSheet button:focus-visible,.amSheet a:focus-visible{outline:0;box-shadow:var(--focus-ring)}
}
@media(max-width:370px){
  .amPanelGreeting h2{font-size:18px}.amPanelPill{padding-inline:9px;font-size:10.5px}
  .amPanelStats{gap:6px}.amPanelStat{padding-inline:8px}.amPanelStat strong{font-size:20px}
  .amListCard{grid-template-columns:48px minmax(0,1fr) auto;gap:8px;padding:12px 10px}
  .amStatus{padding:4px 6px;font-size:9.5px}
  .amDayChip{gap:3px}
  .amSheetPanel{padding-left:12px;padding-right:12px}
}
@media(prefers-reduced-motion:reduce){.amView,.amSheet,.amSheetPanel{animation:none!important}}
@keyframes amRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes amFade{from{opacity:0}to{opacity:1}}
@keyframes amSheetIn{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
`;

const markup = String.raw`
<section class="apptMobilePanelV455" id="apptMobilePanelV455" hidden aria-label="Panel de citas móvil">
  <header class="amPanelGreeting"><div><h2 id="amPanelGreeting">Hola</h2><p id="amPanelDate">Hoy</p></div><span class="amPanelPill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v3M12 18v3M5 12H2M22 12h-3M6 6l-2-2M20 20l-2-2M6 18l-2 2M20 4l-2 2"/><circle cx="12" cy="12" r="3"/></svg>Agenda IA</span></header>
  <section class="amNextHero" id="amPanelNext"></section>
  <p class="amPanelOverline">Tu día</p>
  <div class="amPanelStats">
    <article class="amPanelStat"><strong id="amPanelToday">0</strong><span>Citas hoy</span><small id="amPanelTodayDelta">Agenda al día</small></article>
    <article class="amPanelStat"><strong id="amPanelConfirmed">0</strong><span>Confirmadas</span><small id="amPanelConfirmedRate">0%</small></article>
    <article class="amPanelStat"><strong id="amPanelAvoided">0</strong><span>Ausencias evitadas</span><small id="amPanelAvoidedDelta">Con recordatorios</small></article>
  </div>
  <button class="amReminderLink" type="button" onclick="showAppointmentSection('reminders')"><span class="amReminderIcon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg></span><span class="amReminderCopy"><strong>Recordatorios</strong><span id="amPanelReminderSummary">Todo al día</span></span><span class="amReminderArrow">›</span></button>
</section>
<section class="apptMobileAgendaV454" id="apptMobileAgendaV454" hidden aria-label="Agenda móvil">
  <header class="amAgendaHead"><h2>Agenda</h2><span id="amAgendaCount">0 hoy</span></header>
  <div class="amViewSwitch" role="tablist" aria-label="Vista de agenda">
    <button class="active" type="button" role="tab" data-am-mode="list" aria-selected="true" onclick="setAppointmentMobileModeV454('list')">Lista</button>
    <button type="button" role="tab" data-am-mode="week" aria-selected="false" onclick="setAppointmentMobileModeV454('week')">Semana</button>
    <button type="button" role="tab" data-am-mode="month" aria-selected="false" onclick="setAppointmentMobileModeV454('month')">Mes</button>
  </div>
  <section class="amGuide" id="amAgendaGuide"></section>
  <div class="amView" id="amAgendaView"></div>
  <div class="amSheet" id="amAppointmentSheet" hidden><button class="amSheetScrim" type="button" aria-label="Cerrar detalle" onclick="closeAppointmentMobileSheetV454()"></button><section class="amSheetPanel" id="amAppointmentSheetPanel" role="dialog" aria-modal="true" aria-label="Detalle de cita"></section></div>
</section>
`;

const clientScript = String.raw`
var AM_DAYS_SHORT_V454=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"],AM_DAYS_LONG_V454=["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],AM_MONTHS_LONG_V454=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],AM_MONTHS_SHORT_V454=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function appointmentMobileTodayV454(){var date=appointmentWallDate(new Date());return new Date(date.getFullYear(),date.getMonth(),date.getDate());}
function appointmentMobileAddDaysV454(date,days){var out=new Date(date);out.setDate(out.getDate()+Number(days||0));return out;}
function appointmentMobileMondayV454(date){return appointmentMobileAddDaysV454(date,-((date.getDay()+6)%7));}
function appointmentMobileDateKeyV454(date){return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");}
function appointmentMobileSameDayV454(a,b){return appointmentMobileDateKeyV454(a)===appointmentMobileDateKeyV454(b);}
function appointmentMobileDayOffsetV454(date){return Math.round((new Date(date.getFullYear(),date.getMonth(),date.getDate())-appointmentMobileTodayV454())/864e5);}
function appointmentMobileInitV454(){if(!["list","week","month"].includes(state.appointmentMobileModeV454))state.appointmentMobileModeV454="list";if(!Number.isFinite(Number(state.appointmentMobileWeekV454)))state.appointmentMobileWeekV454=0;if(!Number.isFinite(Number(state.appointmentMobileMonthV454)))state.appointmentMobileMonthV454=0;if(!Number.isFinite(Number(state.appointmentMobileSelectedOffsetV454)))state.appointmentMobileSelectedOffsetV454=0;}
function appointmentMobileStatusV454(row){var status=apptStatus(row);return status==="confirmed"?"conf":status==="needs_you"?"need":"ai";}
function appointmentMobileStatusMetaV454(row){var key=appointmentMobileStatusV454(row),map={conf:{label:"Confirmada",accent:"#14A971",bg:"#e7f7ef",fg:"#0e7a52"},ai:{label:"La agendé yo",accent:"#00A0F0",bg:"var(--cyan-50)",fg:"var(--cyan-700)"},need:{label:"Por confirmar",accent:"#F5A524",bg:"#fff3e0",fg:"#c77d0a"}};return map[key];}
function appointmentMobileRowsForDateV454(date){return appointmentRows().filter(function(row){return apptStatus(row)!=="cancelled"&&appointmentMobileSameDayV454(apptDate(row),date);}).sort(function(a,b){return apptDate(a)-apptDate(b);});}
function appointmentMobileRowsBetweenV454(from,to){var start=new Date(from.getFullYear(),from.getMonth(),from.getDate()),end=new Date(to.getFullYear(),to.getMonth(),to.getDate()+1);return appointmentRows().filter(function(row){var date=apptDate(row);return apptStatus(row)!=="cancelled"&&date>=start&&date<end;}).sort(function(a,b){return apptDate(a)-apptDate(b);});}
function appointmentMobileWeekStartV454(){return appointmentMobileAddDaysV454(appointmentMobileMondayV454(appointmentMobileTodayV454()),Number(state.appointmentMobileWeekV454||0)*7);}
function appointmentMobileMonthStartV454(){var today=appointmentMobileTodayV454();return new Date(today.getFullYear(),today.getMonth()+Number(state.appointmentMobileMonthV454||0),1);}
function appointmentMobileModalityV454(row){var value=String(row.appointment_modality||row.modality||"").toLowerCase();return value==="virtual"||!!String(row.virtual_meeting_link||"").trim()?"virtual":"presencial";}
function appointmentMobileModalityLabelV454(row){return appointmentMobileModalityV454(row)==="virtual"?"Videollamada":"En sitio";}
function appointmentMobileTimeV454(date){return date.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit",hour12:false});}
function appointmentMobileDurationV454(minutes){minutes=Math.max(0,Math.round(Number(minutes)||0));if(minutes<60)return minutes+" min";var hours=Math.floor(minutes/60),rest=minutes%60;return hours+" h"+(rest?" "+rest:"");}
function appointmentMobilePeriodV454(){var mode=state.appointmentMobileModeV454,today=appointmentMobileTodayV454();if(mode==="week"){var start=appointmentMobileWeekStartV454(),end=appointmentMobileAddDaysV454(start,6);return {from:start,to:end,rows:appointmentMobileRowsBetweenV454(start,end)};}if(mode==="month"){var first=appointmentMobileMonthStartV454(),last=new Date(first.getFullYear(),first.getMonth()+1,0);return {from:first,to:last,rows:appointmentMobileRowsBetweenV454(first,last)};}return {from:today,to:today,rows:appointmentMobileRowsForDateV454(today)};}
function appointmentMobileWeekRangeV454(start){var end=appointmentMobileAddDaysV454(start,6);return start.getMonth()===end.getMonth()?start.getDate()+" – "+end.getDate()+" "+AM_MONTHS_SHORT_V454[end.getMonth()]:start.getDate()+" "+AM_MONTHS_SHORT_V454[start.getMonth()]+" – "+end.getDate()+" "+AM_MONTHS_SHORT_V454[end.getMonth()];}
function appointmentMobileCounterV454(period){var count=period.rows.length,mode=state.appointmentMobileModeV454;if(mode==="week")return count+(Number(state.appointmentMobileWeekV454||0)===0?" esta semana":" citas");if(mode==="month")return count+(Number(state.appointmentMobileMonthV454||0)===0?" este mes":" citas");return count+" hoy";}
function appointmentMobilePeriodCopyV454(){if(state.appointmentMobileModeV454==="week"){var start=appointmentMobileWeekStartV454();return Number(state.appointmentMobileWeekV454||0)===0?"de esta semana":"del "+appointmentMobileWeekRangeV454(start);}if(state.appointmentMobileModeV454==="month"){var month=appointmentMobileMonthStartV454();return Number(state.appointmentMobileMonthV454||0)===0?"de este mes":"de "+AM_MONTHS_LONG_V454[month.getMonth()];}return "de hoy";}
function appointmentMobileGuideCopyV454(period){var total=period.rows.length,needs=period.rows.filter(function(row){return appointmentMobileStatusV454(row)==="need";}).length,scope=appointmentMobilePeriodCopyV454();if(!total)return "Sin citas "+scope+". Te dejé el espacio libre.";if(!needs)return "Agendé y confirmé tus "+total+" citas "+scope+".";return "Agendé tus "+total+" citas "+scope+". Ya confirmé "+(total-needs)+".";}
function appointmentMobileNextPlanV454(){var now=appointmentWallDate(new Date()),limit=appointmentMobileAddDaysV454(appointmentMobileTodayV454(),14),next=appointmentRows().filter(function(row){var date=apptDate(row);return apptStatus(row)!=="cancelled"&&date>=now&&date<limit;}).sort(function(a,b){return apptDate(a)-apptDate(b);})[0];if(!next)return "Nada que hacer de tu parte.";var date=apptDate(next),today=appointmentMobileTodayV454(),offset=appointmentMobileDayOffsetV454(date),when=offset===0?"hoy a las "+appointmentMobileTimeV454(date):offset===1?"mañana a las "+appointmentMobileTimeV454(date):AM_DAYS_LONG_V454[date.getDay()].toLowerCase()+" "+date.getDate()+" a las "+appointmentMobileTimeV454(date);return "Lo único tuyo: presentarte "+when+" — "+(next.customer_name||"tu cliente")+".";}
function appointmentMobileGuideMarkupV454(period){var needs=period.rows.filter(function(row){return appointmentMobileStatusV454(row)==="need";}).length;return '<div class="amGuideTop"><span class="amGuideIcon">✦</span><div><small>Ya me encargué</small><strong>'+esc(appointmentMobileGuideCopyV454(period))+'</strong></div></div><div class="amGuidePlan"><i>✓</i><span>'+esc(appointmentMobileNextPlanV454())+'</span></div>'+(needs?'<button type="button" onclick="appointmentMobileNudgePeriodV454()">'+esc(needs===1?"Que insista al que falta":"Que insista a los "+needs+" que faltan")+'</button>':"");}
function appointmentMobileCardV454(row,tomorrow){var date=apptDate(row),meta=appointmentMobileStatusMetaV454(row),duration=Number(row.duration_minutes)||60;return '<button class="amListCard '+(tomorrow?'tomorrow':'')+'" style="--am-accent:'+meta.accent+'" type="button" data-id="'+attr(appointmentId(row))+'" onclick="openAppointment(this.dataset.id)"><span class="amListTime"><strong>'+esc(appointmentMobileTimeV454(date))+'</strong>'+(tomorrow?'':'<small>'+esc(duration+" min")+'</small>')+'</span><span class="amListInfo"><strong>'+esc(row.consultation_reason||"Cita")+'</strong><span>'+esc((row.customer_name||"Cliente")+" · "+appointmentMobileModalityLabelV454(row))+'</span></span>'+(tomorrow?'':'<span class="amStatus" style="background:'+meta.bg+';color:'+meta.fg+'">'+esc(meta.label)+'</span>')+'</button>';}
function appointmentMobileListV454(){var today=appointmentMobileTodayV454(),tomorrow=appointmentMobileAddDaysV454(today,1),todayRows=appointmentMobileRowsForDateV454(today),tomorrowRows=appointmentMobileRowsForDateV454(tomorrow),tomorrowName=AM_DAYS_LONG_V454[tomorrow.getDay()]+" "+tomorrow.getDate();var section=function(label,rows,isTomorrow){return '<section class="amListSection"><h3 class="amOverline">'+esc(label)+'</h3>'+(rows.length?'<div class="amListCards">'+rows.map(function(row){return appointmentMobileCardV454(row,isTomorrow);}).join("")+'</div>':'<div class="amEmpty"><strong>Día libre</strong><p>No agendé nada aquí. Si alguien escribe, yo le ofrezco otro día.</p></div>')+'</section>';};return section("Hoy · "+today.getDate()+" "+AM_MONTHS_SHORT_V454[today.getMonth()],todayRows,false)+section(tomorrowName,tomorrowRows,true);}
function appointmentMobileDotsV454(rows,selected){return '<span class="amDots">'+rows.slice(0,3).map(function(row){return '<i style="--dot:'+(selected?'rgba(255,255,255,.9)':appointmentMobileStatusMetaV454(row).accent)+'"></i>';}).join("")+'</span>';}
function appointmentMobileWeekV454(){var start=appointmentMobileWeekStartV454(),end=appointmentMobileAddDaysV454(start,6),today=appointmentMobileTodayV454(),selected=appointmentMobileAddDaysV454(today,Number(state.appointmentMobileSelectedOffsetV454||0));if(selected<start||selected>end){selected=new Date(start);state.appointmentMobileSelectedOffsetV454=appointmentMobileDayOffsetV454(selected);}var days=Array.from({length:7},function(_,index){var date=appointmentMobileAddDaysV454(start,index),rows=appointmentMobileRowsForDateV454(date),isSelected=appointmentMobileSameDayV454(date,selected),classes="amDayChip"+(appointmentMobileSameDayV454(date,today)?" today":"")+(isSelected?" selected":"");return '<button class="'+classes+'" type="button" data-offset="'+appointmentMobileDayOffsetV454(date)+'" onclick="selectAppointmentMobileDayV454(this.dataset.offset)"><small>'+AM_DAYS_SHORT_V454[index]+'</small><strong>'+date.getDate()+'</strong>'+appointmentMobileDotsV454(rows,isSelected)+'</button>';}).join("");var rows=appointmentMobileRowsForDateV454(selected),minutes=rows.reduce(function(sum,row){return sum+(Number(row.duration_minutes)||60);},0),label=(appointmentMobileSameDayV454(selected,today)?"Hoy · ":"")+AM_DAYS_LONG_V454[selected.getDay()]+" "+selected.getDate(),meta=rows.length?(rows.length+(rows.length===1?" cita":" citas")+" · "+appointmentMobileDurationV454(minutes)+" de tu día"):"libre",timeline=appointmentMobileTimelineV454(rows,selected);return '<div class="amPeriodNav"><button type="button" aria-label="Semana anterior" onclick="moveAppointmentMobileWeekV454(-1)">‹</button><strong>'+esc(appointmentMobileWeekRangeV454(start)+(Number(state.appointmentMobileWeekV454||0)===0?" · esta semana":""))+'</strong><button type="button" aria-label="Semana siguiente" onclick="moveAppointmentMobileWeekV454(1)">›</button></div><div class="amWeekDays">'+days+'</div><div class="amDayMeta"><strong>'+esc(label)+'</strong><span>'+esc(meta)+'</span></div>'+timeline;}
function appointmentMobileTimelineV454(rows,date){if(!rows.length)return '<div class="amEmpty"><strong>Día libre</strong><p>No agendé nada aquí. Si alguien escribe, yo le ofrezco otro día.</p></div>';var starts=rows.map(function(row){var d=apptDate(row);return d.getHours()+d.getMinutes()/60;}),ends=rows.map(function(row,index){return starts[index]+(Number(row.duration_minutes)||60)/60;}),from=Math.floor(Math.min.apply(Math,starts)),to=Math.ceil(Math.max.apply(Math,ends)),pph=86,height=(to-from)*pph+12,hours=Array.from({length:to-from+1},function(_,index){return '<div class="amHour" style="top:'+(index*pph)+'px"><span>'+(from+index)+':00</span><i></i></div>';}).join(""),blocks=rows.map(function(row,index){var start=starts[index],duration=(Number(row.duration_minutes)||60),top=Math.round((start-from)*pph+2),blockHeight=Math.max(82,Math.round(duration/60*pph-4)),dateStart=apptDate(row),dateEnd=new Date(dateStart.getTime()+duration*60000),meta=appointmentMobileStatusMetaV454(row);return '<button class="amTimelineCard" style="top:'+top+'px;height:'+blockHeight+'px;--am-accent:'+meta.accent+'" type="button" data-id="'+attr(appointmentId(row))+'" onclick="openAppointment(this.dataset.id)"><span class="amTimelineTop"><span>'+esc(appointmentMobileTimeV454(dateStart)+" – "+appointmentMobileTimeV454(dateEnd))+'</span><i class="amStatus" style="background:'+meta.bg+';color:'+meta.fg+'">'+esc(meta.label)+'</i></span><h4>'+esc(row.consultation_reason||"Cita")+'</h4><p>'+esc((row.customer_name||"Cliente")+" · "+appointmentMobileModalityLabelV454(row))+'</p></button>';}).join(""),now=appointmentWallDate(new Date()),nowHour=now.getHours()+now.getMinutes()/60,nowLine=appointmentMobileSameDayV454(date,appointmentMobileTodayV454())&&nowHour>=from&&nowHour<=to?'<span class="amNow" style="top:'+Math.round((nowHour-from)*pph)+'px"></span>':"";return '<div class="amTimeline" style="height:'+height+'px">'+hours+nowLine+blocks+'</div>';}
function appointmentMobileMonthV454(){var month=appointmentMobileMonthStartV454(),today=appointmentMobileTodayV454(),weekday=(month.getDay()+6)%7,start=appointmentMobileAddDaysV454(month,-weekday),head=AM_DAYS_SHORT_V454.map(function(day){return '<span>'+day+'</span>';}).join(""),cells=Array.from({length:42},function(_,index){var date=appointmentMobileAddDaysV454(start,index),inside=date.getMonth()===month.getMonth(),rows=inside?appointmentMobileRowsForDateV454(date):[],classes="amMonthCell"+(inside?'':' outside')+(appointmentMobileSameDayV454(date,today)?" today":""),enabled=inside&&rows.length;return '<button class="'+classes+'" type="button" '+(enabled?'data-date="'+appointmentMobileDateKeyV454(date)+'" onclick="openAppointmentMobileDateV454(this.dataset.date)"':'disabled')+'><span class="amMonthNumber">'+date.getDate()+'</span>'+appointmentMobileDotsV454(rows,false)+'</button>';}).join("");return '<div class="amPeriodNav"><button type="button" aria-label="Mes anterior" onclick="moveAppointmentMobileMonthV454(-1)">‹</button><strong>'+esc(AM_MONTHS_LONG_V454[month.getMonth()].charAt(0).toUpperCase()+AM_MONTHS_LONG_V454[month.getMonth()].slice(1)+" "+month.getFullYear())+'</strong><button type="button" aria-label="Mes siguiente" onclick="moveAppointmentMobileMonthV454(1)">›</button></div><div class="amMonthCard"><div class="amMonthHead">'+head+'</div><div class="amMonthGrid">'+cells+'</div></div><div class="amMonthLegend"><span><i style="--dot:#14A971"></i>Confirmada</span><span><i style="--dot:#00A0F0"></i>La agendé yo</span><span><i style="--dot:#F5A524"></i>Por confirmar</span></div><p class="amMonthHint">Toca un día para ver quién viene.</p>';}
function appointmentMobilePanelRelativeV455(date){var now=appointmentWallDate(new Date()),minutes=Math.round((date-now)/60000),offset=appointmentMobileDayOffsetV454(date);if(minutes>=0&&minutes<60)return "en "+minutes+" min";if(minutes>=60&&minutes<1440)return "en "+Math.round(minutes/60)+" h";if(offset===1)return "mañana";if(offset===0)return "hoy";return AM_DAYS_LONG_V454[date.getDay()].toLowerCase()+" "+date.getDate();}
function appointmentMobilePanelNextV455(){var now=appointmentWallDate(new Date());return appointmentRows().filter(function(row){return apptStatus(row)!=="cancelled"&&apptDate(row)>=now;}).sort(function(a,b){return apptDate(a)-apptDate(b);})[0]||null;}
function appointmentMobilePanelReminderSummaryV455(){var rows=state.appointments&&state.appointments.reminders||[],attention=rows.filter(function(row){return ["no_response","failed","retrying","blocked_configuration","missed"].includes(String(row.status||""));}).length,scheduled=rows.filter(function(row){return row.group==="upcoming"||["scheduled","programmed","paused","sending"].includes(String(row.status||""));}).length;if(!attention&&!scheduled)return "Todo al día";return (attention?attention+" sin respuesta":"Todo respondido")+" · "+scheduled+" programado"+(scheduled===1?"":"s");}
function openAppointmentMobilePanelAgendaV455(id){var row=appointmentById(id),date=row?apptDate(row):appointmentMobileTodayV454(),monday=appointmentMobileMondayV454(date),todayMonday=appointmentMobileMondayV454(appointmentMobileTodayV454());state.appointmentMobileModeV454="week";state.appointmentMobileWeekV454=Math.round((monday-todayMonday)/6048e5);state.appointmentMobileSelectedOffsetV454=appointmentMobileDayOffsetV454(date);showAppointmentSection("agenda");}
function renderAppointmentMobilePanelV455(){var root=document.getElementById("apptMobilePanelV455"),hero=document.getElementById("amPanelNext");if(!root||!hero||!state.appointments)return;var business=String(PANEL_CONTEXT.businessName||"tu empresa").trim(),today=appointmentMobileTodayV454(),todayRows=appointmentMobileRowsForDateV454(today),confirmed=todayRows.filter(function(row){return appointmentMobileStatusV454(row)==="conf";}).length,rate=todayRows.length?Math.round(confirmed/todayRows.length*100):0,metrics=state.appointments.metrics||{},next=appointmentMobilePanelNextV455();text("amPanelGreeting","Hola, "+business);text("amPanelDate",today.toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"}));text("amPanelToday",todayRows.length);text("amPanelTodayDelta",todayRows.length?"Agenda al día":"Día libre");text("amPanelConfirmed",confirmed);text("amPanelConfirmedRate",rate+"%");text("amPanelAvoided",Number(metrics.avoided_absences)||0);text("amPanelAvoidedDelta","Con recordatorios");text("amPanelReminderSummary",appointmentMobilePanelReminderSummaryV455());if(!next){hero.classList.add("empty");hero.innerHTML='<small>Tu próxima cita</small><h3>No tienes citas próximas</h3><p>Cuando alguien reserve, aparecerá aquí con toda la información necesaria.</p><button type="button" onclick="showAppointmentSection(\'agenda\')">Ver agenda <span>›</span></button>';return;}hero.classList.remove("empty");var date=apptDate(next);hero.innerHTML='<small>Tu próxima cita</small><div class="amNextTime"><strong>'+esc(appointmentMobileTimeV454(date))+'</strong><span>'+esc(appointmentMobilePanelRelativeV455(date))+'</span></div><h3>'+esc(next.consultation_reason||"Cita")+'</h3><p>'+esc(next.customer_name||"Cliente")+'</p><button type="button" data-id="'+attr(appointmentId(next))+'" onclick="openAppointmentMobilePanelAgendaV455(this.dataset.id)">Ver agenda del día <span>›</span></button>';}
function renderAppointmentMobileAgendaV454(){var root=document.getElementById("apptMobileAgendaV454"),view=document.getElementById("amAgendaView"),guide=document.getElementById("amAgendaGuide");if(!root||!view||!state.appointments)return;appointmentMobileInitV454();var period=appointmentMobilePeriodV454();text("amAgendaCount",appointmentMobileCounterV454(period));document.querySelectorAll("[data-am-mode]").forEach(function(button){var active=button.dataset.amMode===state.appointmentMobileModeV454;button.classList.toggle("active",active);button.setAttribute("aria-selected",active?"true":"false");});guide.innerHTML=appointmentMobileGuideMarkupV454(period);view.innerHTML=state.appointmentMobileModeV454==="week"?appointmentMobileWeekV454():state.appointmentMobileModeV454==="month"?appointmentMobileMonthV454():appointmentMobileListV454();if(state.appointmentMobileOpenV454)renderAppointmentMobileSheetV454();}
function setAppointmentMobileModeV454(mode){appointmentMobileInitV454();state.appointmentMobileModeV454=["list","week","month"].includes(mode)?mode:"list";renderAppointmentMobileAgendaV454();}
function selectAppointmentMobileDayV454(offset){state.appointmentMobileSelectedOffsetV454=Number(offset)||0;renderAppointmentMobileAgendaV454();}
function moveAppointmentMobileWeekV454(delta){appointmentMobileInitV454();state.appointmentMobileWeekV454+=Number(delta)||0;var target=appointmentMobileAddDaysV454(appointmentMobileMondayV454(appointmentMobileTodayV454()),state.appointmentMobileWeekV454*7);state.appointmentMobileSelectedOffsetV454=appointmentMobileDayOffsetV454(target);renderAppointmentMobileAgendaV454();}
function moveAppointmentMobileMonthV454(delta){appointmentMobileInitV454();state.appointmentMobileMonthV454+=Number(delta)||0;renderAppointmentMobileAgendaV454();}
function openAppointmentMobileDateV454(value){var date=new Date(String(value||"")+"T12:00:00"),monday=appointmentMobileMondayV454(date),todayMonday=appointmentMobileMondayV454(appointmentMobileTodayV454());state.appointmentMobileModeV454="week";state.appointmentMobileWeekV454=Math.round((monday-todayMonday)/6048e5);state.appointmentMobileSelectedOffsetV454=appointmentMobileDayOffsetV454(date);renderAppointmentMobileAgendaV454();}
function appointmentMobileIsViewportV454(){return !!(window.matchMedia&&window.matchMedia("(max-width:760px)").matches);}
function openAppointmentMobileSheetV454(id){state.selectedAppointment=id;state.appointmentMobileOpenV454=id;renderAppointmentMobileSheetV454();var sheet=document.getElementById("amAppointmentSheet");if(sheet)sheet.hidden=false;document.body.style.overflow="hidden";var row=appointmentById(id);if(row&&appointmentMobileModalityV454(row)==="virtual"&&!String(row.virtual_meeting_link||"").trim()&&typeof scheduleAppointmentMeetingRefresh==="function")scheduleAppointmentMeetingRefresh(row);}
function closeAppointmentMobileSheetV454(){state.appointmentMobileOpenV454=null;var sheet=document.getElementById("amAppointmentSheet");if(sheet)sheet.hidden=true;document.body.style.overflow="";if(typeof clearAppointmentMeetingRefresh==="function")clearAppointmentMeetingRefresh();}
function appointmentMobileProviderV454(row){var source=String(row.virtual_link_source||"").toLowerCase(),url=String(row.virtual_meeting_link||"");if(source==="google_meet"||/meet\.google\.com/i.test(url))return "Google Meet";if(/zoom\.us/i.test(url))return "Zoom";if(/teams\.microsoft\.com/i.test(url))return "Microsoft Teams";return source==="manual"?"Enlace manual":"Videollamada";}
function appointmentMobileMeetingEditV454(value,hidden){return '<form class="amMeetingEdit" id="amMeetingEditV454" autocomplete="off" data-form-type="other" '+(hidden?'hidden':'')+' onsubmit="event.preventDefault();saveAppointmentMobileMeetingV454()"><textarea id="amMeetingUrlV454" name="appointment_meeting_link_text" rows="1" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" aria-autocomplete="none" data-form-type="other" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" aria-label="Enlace de videollamada">'+esc(value||"")+'</textarea><button type="submit">Guardar enlace</button></form>';}
function showAppointmentMobileMeetingEditV454(){var form=document.getElementById("amMeetingEditV454"),field=document.getElementById("amMeetingUrlV454");if(form)form.hidden=false;if(field){field.focus();field.select();}}
function appointmentMobileWhereV454(row){var virtual=appointmentMobileModalityV454(row)==="virtual",url=String(row.virtual_meeting_link||"").trim();if(virtual){if(!url)return '<section class="amWhere"><small>¿Dónde se ven?</small><h4>Videollamada · Requiere atención</h4><p class="amNeedsLink">La cita es virtual, pero el enlace todavía no está disponible. Vuelvo a consultarlo automáticamente.</p>'+appointmentMobileMeetingEditV454("",false)+'</section>';return '<section class="amWhere"><small>¿Dónde se ven?</small><h4>'+esc(appointmentMobileProviderV454(row))+'</h4><div class="amMeetingUrl">'+esc(url)+'</div><div class="amWhereActions"><a class="primary" href="'+attr(url)+'" target="_blank" rel="noopener noreferrer" onclick="appointmentToast(\'Abro la videollamada en tu app de reuniones.\')">Abrir</a><button class="secondary" type="button" onclick="copyAppointmentMobileMeetingV454()">Copiar enlace</button></div><button class="amReplaceLink" type="button" onclick="showAppointmentMobileMeetingEditV454()">Reemplazar enlace</button>'+appointmentMobileMeetingEditV454(url,true)+'<p class="amWhereNote">Ya le mandé este enlace al cliente por WhatsApp.</p></section>';}var address=String(row.physical_address||row.address||"").trim(),directions=String(row.physical_directions||"").trim(),map=String(row.physical_maps_link||"").trim();if(!map&&address)map="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(address);return '<section class="amWhere"><small>¿Dónde se ven?</small><h4>En sitio</h4><p class="amWhereNote">'+esc(address||"La dirección todavía requiere atención.")+'</p>'+(directions?'<p class="amWhereNote">'+esc(directions)+'</p>':'')+(map?'<div class="amWhereActions"><a class="secondary" style="grid-column:1/-1" href="'+attr(map)+'" target="_blank" rel="noopener noreferrer" onclick="appointmentToast(\'Abro la dirección en tu mapa.\')">Ver en el mapa</a></div>':'')+(address?'<p class="amWhereNote">Ya le compartí la dirección al cliente por WhatsApp.</p>':'')+'</section>';}
function renderAppointmentMobileSheetV454(){var panel=document.getElementById("amAppointmentSheetPanel"),sheet=document.getElementById("amAppointmentSheet"),row=appointmentById(state.appointmentMobileOpenV454);if(!panel||!sheet||!row)return;var start=apptDate(row),duration=Number(row.duration_minutes)||60,end=new Date(start.getTime()+duration*60000),status=appointmentMobileStatusMetaV454(row),virtual=appointmentMobileModalityV454(row)==="virtual",effectiveStatus=virtual&&!String(row.virtual_meeting_link||"").trim()?{label:"Por confirmar",accent:"#F5A524",bg:"#fff3e0",fg:"#c77d0a"}:status,dateLabel=AM_DAYS_LONG_V454[start.getDay()]+" "+start.getDate()+" de "+AM_MONTHS_LONG_V454[start.getMonth()],step=(virtual?"Entrar al enlace":"Estar en el sitio")+" a las "+appointmentMobileTimeV454(start)+". Del recordatorio me encargo yo.",primary=appointmentMobileStatusV454(row)==="need"?"Insistir por WhatsApp":"Reenviar recordatorio";panel.innerHTML='<div class="amSheetHandle"></div><header class="amSheetHead"><div><span class="amStatus" style="display:inline-flex;background:'+effectiveStatus.bg+';color:'+effectiveStatus.fg+'">'+esc(effectiveStatus.label)+'</span><h3>'+esc(row.consultation_reason||"Cita")+'</h3><p>'+esc(row.customer_name||"Cliente")+'</p></div><button class="amSheetClose" type="button" aria-label="Cerrar" onclick="closeAppointmentMobileSheetV454()">×</button></header><div class="amSheetChips"><span>◷ '+esc(appointmentMobileTimeV454(start)+" – "+appointmentMobileTimeV454(end))+'</span><span>▣ '+esc(dateLabel)+'</span></div>'+appointmentMobileWhereV454(row)+'<section class="amOnlyStep"><i>✓</i><div><small>Tu único paso</small><p>'+esc(step)+'</p></div></section><footer class="amSheetFooter"><button class="secondary" type="button" data-id="'+attr(appointmentId(row))+'" onclick="appointmentMobileRescheduleV454(this.dataset.id)">Reprogramar</button><button class="primary" type="button" data-id="'+attr(appointmentId(row))+'" onclick="appointmentMobileReminderV454(this.dataset.id)">'+esc(primary)+'</button></footer>';sheet.hidden=false;}
function copyAppointmentMobileMeetingV454(){var row=appointmentById(state.appointmentMobileOpenV454),url=String(row&&row.virtual_meeting_link||"").trim();if(!url)return;var done=function(){appointmentToast("Enlace copiado. Ya se lo mandé al cliente también.");};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(done).catch(function(){window.prompt("Copia el enlace:",url);});else window.prompt("Copia el enlace:",url);}
function saveAppointmentMobileMeetingV454(){var row=appointmentById(state.appointmentMobileOpenV454),field=document.getElementById("amMeetingUrlV454"),url=String(field&&field.value||"").trim();if(!row||!url){appointmentToast("Pega el enlace seguro de la reunión.");return;}appointmentToast("Guardando enlace…");api("/admin/panel/appointments/"+encodeURIComponent(appointmentId(row))+"/virtual-link",{method:"PUT",body:JSON.stringify({virtual_meeting_link:url})}).then(function(payload){if(payload&&payload.appointment){appointmentDetailUpdate(payload.appointment);state.appointmentMobileOpenV454=appointmentId(payload.appointment);}return typeof refreshAppointmentMeeting==="function"?refreshAppointmentMeeting():payload;}).then(function(){renderAppointmentMobileAgendaV454();renderAppointmentMobileSheetV454();appointmentToast("Enlace actualizado en la cita.");}).catch(function(error){appointmentToast(error.body&&error.body.message||error.body&&error.body.error||"No pudimos guardar el enlace.");});}
function appointmentMobileReminderRecordV454(row){var id=String(appointmentId(row));return (state.appointments&&state.appointments.reminders||[]).find(function(reminder){return String(reminder.appointment_id||"")===id;});}
function appointmentMobileApplyReminderPayloadV454(payload){if(!state.appointments)return;if(payload&&Array.isArray(payload.reminders))state.appointments.reminders=payload.reminders;else if(payload&&payload.reminder){var rows=state.appointments.reminders||[],index=rows.findIndex(function(item){return String(item.id)===String(payload.reminder.id);});if(index>=0)rows[index]=payload.reminder;else rows.push(payload.reminder);state.appointments.reminders=rows;}if(payload&&payload.reminder_metrics)state.appointments.reminder_metrics=payload.reminder_metrics;}
function appointmentMobileSendReminderV454(row,quiet){var reminder=appointmentMobileReminderRecordV454(row);if(!reminder)return Promise.resolve(false);if(state.appointments&&state.appointments.source==="demo")return Promise.resolve(true);var action=["failed","no_response","retrying"].includes(String(reminder.status||""))?"retry":"send_now";return api("/admin/panel/appointment-reminders/"+encodeURIComponent(reminder.id)+"/action",{method:"POST",body:JSON.stringify({action:action})}).then(function(payload){appointmentMobileApplyReminderPayloadV454(payload);return true;}).catch(function(error){if(!quiet)appointmentToast(error.body&&error.body.message||"No pudimos enviar el recordatorio.");return false;});}
function appointmentMobileReminderV454(id){var row=appointmentById(id);if(!row)return;appointmentMobileSendReminderV454(row,false).then(function(sent){if(!sent){appointmentToast("Esta cita aún no tiene un recordatorio listo para enviar.");return;}closeAppointmentMobileSheetV454();appointmentToast(appointmentMobileStatusV454(row)==="need"?"Le insisto por WhatsApp hasta que confirme.":"Listo, le reenvié el recordatorio.");renderAppointmentMobileAgendaV454();});}
function appointmentMobileNudgePeriodV454(){var rows=appointmentMobilePeriodV454().rows.filter(function(row){return appointmentMobileStatusV454(row)==="need";});Promise.all(rows.map(function(row){return appointmentMobileSendReminderV454(row,true);})).then(function(results){var sent=results.filter(Boolean).length;if(!sent){appointmentToast("No hay recordatorios listos para reenviar.");return;}appointmentToast("Les escribo por WhatsApp hasta que confirmen.");renderAppointmentMobileAgendaV454();});}
function appointmentMobileRescheduleV454(id){var row=appointmentById(id);if(!row)return;if(state.appointments&&state.appointments.source==="demo"){closeAppointmentMobileSheetV454();appointmentToast("Le propongo 3 horarios nuevos por WhatsApp.");return;}closeAppointmentMobileSheetV454();appointmentAction("reprogram",id,{reason:"Reprogramación solicitada desde la agenda móvil",message:"El usuario Nextfor pidió ofrecer tres horarios nuevos al cliente."},"Le propongo 3 horarios nuevos por WhatsApp.");}
function retryAppointmentMobileAgendaV454(){state.appointments=null;loadAppointments();}
var showAppointmentSectionBeforeMobileV454=showAppointmentSection;
showAppointmentSection=function(section){showAppointmentSectionBeforeMobileV454(section);var app=document.getElementById("appointmentApp"),agenda=document.getElementById("apptMobileAgendaV454"),panel=document.getElementById("apptMobilePanelV455"),agendaActive=state.appointmentSection==="agenda",panelActive=state.appointmentSection==="panel";if(app){app.classList.toggle("apptMobileAgendaActive",agendaActive);app.classList.toggle("apptMobilePanelActiveV455",panelActive);}if(agenda)agenda.hidden=!agendaActive;if(panel)panel.hidden=!panelActive;if(agendaActive)renderAppointmentMobileAgendaV454();if(panelActive)renderAppointmentMobilePanelV455();};
var renderAppointmentsBeforeMobileV454=renderAppointments;
renderAppointments=function(){renderAppointmentsBeforeMobileV454();renderAppointmentMobileAgendaV454();renderAppointmentMobilePanelV455();};
var openAppointmentBeforeMobileV454=openAppointment;
openAppointment=function(id){if(appointmentMobileIsViewportV454()&&state.appointmentSection==="agenda"){openAppointmentMobileSheetV454(id);return;}openAppointmentBeforeMobileV454(id);};
var closeAppointmentDetailBeforeMobileV454=closeAppointmentDetail;
closeAppointmentDetail=function(){var sheet=document.getElementById("amAppointmentSheet");if(sheet&&!sheet.hidden){closeAppointmentMobileSheetV454();return;}closeAppointmentDetailBeforeMobileV454();};
`;

module.exports = { styles, markup, clientScript };
