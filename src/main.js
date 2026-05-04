import './style.css'

let selectedDay = null;
let selectedFilter = 'all';
let currentTheme = localStorage.getItem('theme') || 'light';
let currentPalette = localStorage.getItem('palette') || 'white';
let searchQuery = '';
let selectedTasks = new Set();
const dayLabels = ['一', '二', '三', '四', '五', '六', '日'];

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    showNotification('存储失败：请检查浏览器存储空间或隐私设置');
  }
}

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function normalizeWeeklyTasks(tasks) {
  const normalized = {};
  for (let i = 0; i < 7; i++) {
    normalized[i] = {};
    for (let h = 7; h < 24; h++) {
      const dayTasks = tasks?.[i]?.[h];
      if (Array.isArray(dayTasks)) {
        normalized[i][h] = dayTasks.map(task => ({
          id: task.id,
          text: task.text,
          completed: task.completed || false,
          priority: task.priority || 'medium', // 默认中等优先级
          dueDate: task.dueDate || ''
        }));
      } else {
        normalized[i][h] = [];
      }
    }
  }
  return normalized;
}

function ensureWeeklyReset() {
  const currentWeekStart = getWeekStart();
  const lastReset = localStorage.getItem('weeklyResetStart');
  if (lastReset !== currentWeekStart) {
    localStorage.setItem('weeklyTasks', JSON.stringify(normalizeWeeklyTasks({})));
    localStorage.setItem('weeklyResetStart', currentWeekStart);
  }
}

// 初始化存储
function initStorage() {
  ensureWeeklyReset();
  const existing = localStorage.getItem('weeklyTasks');
  if (!existing) {
    writeStorage('weeklyTasks', JSON.stringify(normalizeWeeklyTasks({})));
  } else {
    const parsed = normalizeWeeklyTasks(readJSON('weeklyTasks', {}));
    writeStorage('weeklyTasks', JSON.stringify(parsed));
  }
  if (!localStorage.getItem('weeklyGoal')) {
    localStorage.setItem('weeklyGoal', '');
  }
  if (!localStorage.getItem('weeklyHabits')) {
    localStorage.setItem('weeklyHabits', JSON.stringify([]));
  }
  if (!localStorage.getItem('weeklyCheckins')) {
    localStorage.setItem('weeklyCheckins', JSON.stringify({
      mood: Array(7).fill(''),
      energy: Array(7).fill('')
    }));
  }
  if (!localStorage.getItem('onboardingCompleted')) {
    localStorage.setItem('onboardingCompleted', 'false');
  }

  // 应用主题
  applyTheme();
}

function normalizeHabits(habits) {
  if (!Array.isArray(habits)) return [];
  return habits.map(habit => {
    const checks = Array.isArray(habit?.checks) ? habit.checks.slice(0, 7) : [];
    while (checks.length < 7) checks.push(false);
    return {
      id: habit.id || createTaskId(),
      name: habit.name || '未命名习惯',
      checks: checks.map(Boolean)
    };
  });
}

function getHabits() {
  return normalizeHabits(readJSON('weeklyHabits', []));
}

function saveHabits(habits) {
  writeStorage('weeklyHabits', JSON.stringify(normalizeHabits(habits)));
}

function getRewardLevel(points) {
  if (points >= 120) return { title: '自律大师', badge: '🏆' };
  if (points >= 80) return { title: '高效达人', badge: '🥇' };
  if (points >= 40) return { title: '稳定进步', badge: '🥈' };
  return { title: '起步阶段', badge: '🌱' };
}

function getWeeklyCheckins() {
  const raw = readJSON('weeklyCheckins', {});
  const mood = Array.isArray(raw.mood) ? raw.mood.slice(0, 7) : [];
  const energy = Array.isArray(raw.energy) ? raw.energy.slice(0, 7) : [];
  while (mood.length < 7) mood.push('');
  while (energy.length < 7) energy.push('');
  return { mood, energy };
}

function saveWeeklyCheckins(checkins) {
  writeStorage('weeklyCheckins', JSON.stringify({
    mood: (checkins.mood || Array(7).fill('')).slice(0, 7),
    energy: (checkins.energy || Array(7).fill('')).slice(0, 7)
  }));
}

function exportAppData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    weeklyTasks: readJSON('weeklyTasks', {}),
    weeklyGoal: localStorage.getItem('weeklyGoal') || '',
    weeklyHabits: getHabits(),
    weeklyCheckins: getWeeklyCheckins(),
    theme: localStorage.getItem('theme') || 'light',
    palette: localStorage.getItem('palette') || 'white',
    weeklyResetStart: localStorage.getItem('weeklyResetStart') || getWeekStart()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `weekly-planner-backup-${getWeekStart()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importAppDataFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const normalizedTasks = normalizeWeeklyTasks(data.weeklyTasks || {});
      const normalizedHabits = normalizeHabits(data.weeklyHabits || []);
      const checkins = {
        mood: Array.isArray(data.weeklyCheckins?.mood) ? data.weeklyCheckins.mood.slice(0, 7) : Array(7).fill(''),
        energy: Array.isArray(data.weeklyCheckins?.energy) ? data.weeklyCheckins.energy.slice(0, 7) : Array(7).fill('')
      };
      while (checkins.mood.length < 7) checkins.mood.push('');
      while (checkins.energy.length < 7) checkins.energy.push('');

      localStorage.setItem('weeklyTasks', JSON.stringify(normalizedTasks));
      localStorage.setItem('weeklyGoal', typeof data.weeklyGoal === 'string' ? data.weeklyGoal : '');
      localStorage.setItem('weeklyHabits', JSON.stringify(normalizedHabits));
      localStorage.setItem('weeklyCheckins', JSON.stringify(checkins));
      localStorage.setItem('weeklyResetStart', typeof data.weeklyResetStart === 'string' ? data.weeklyResetStart : getWeekStart());

      if (data.theme === 'light' || data.theme === 'dark') currentTheme = data.theme;
      if (typeof data.palette === 'string' && data.palette) currentPalette = data.palette;
      applyTheme();
      selectedTasks.clear();
      render();
      showNotification('数据导入成功，已恢复备份内容');
    } catch (error) {
      showNotification('导入失败：文件格式不正确');
    }
  };
  reader.readAsText(file);
}

function calculateHabitStreak(checks) {
  let streak = 0;
  for (let i = checks.length - 1; i >= 0; i--) {
    if (!checks[i]) break;
    streak++;
  }
  return streak;
}

function exportWeeklyReport(tasks, habits, stats, checkins) {
  const now = new Date();
  const moodMap = { happy: '开心', calm: '平静', tired: '疲惫', stressed: '焦虑' };
  const energyMap = { high: '高', medium: '中', low: '低' };
  const moodRows = dayLabels.map((label, idx) =>
    `<tr><td>周${label}</td><td>${moodMap[checkins.mood[idx]] || '-'}</td><td>${energyMap[checkins.energy[idx]] || '-'}</td></tr>`
  ).join('');
  const habitRows = habits.length > 0
    ? habits.map(habit => `
      <tr>
        <td>${habit.name}</td>
        <td>${habit.checks.map(v => (v ? '✓' : '·')).join(' ')}</td>
        <td>${calculateHabitStreak(habit.checks)} 天</td>
      </tr>
    `).join('')
    : '<tr><td colspan="3">本周暂无习惯数据</td></tr>';

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>Weekly Planner 周报</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; background: #f6f8ff; color: #1f2937; margin: 0; padding: 24px; }
    .wrap { max-width: 980px; margin: 0 auto; }
    .title { margin-bottom: 16px; }
    .meta { color: #64748b; font-size: 14px; margin-bottom: 16px; }
    .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
    .card { background: #fff; border: 1px solid #dbe3ff; border-radius: 14px; padding: 12px; }
    .card strong { font-size: 24px; color: #1d4ed8; }
    .bar { height: 12px; border-radius: 999px; background: #e5e7eb; overflow: hidden; margin-top: 8px; }
    .bar > span { display: block; height: 100%; background: linear-gradient(90deg, #4f46e5, #60a5fa); }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 14px; overflow: hidden; margin-top: 14px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; font-size: 14px; }
    th { background: #eef2ff; }
    h2 { margin-top: 22px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1 class="title">Weekly Planner 可视化周报</h1>
    <div class="meta">导出时间：${now.toLocaleString()} ｜ 周起始：${getWeekStart()}</div>
    <div class="cards">
      <div class="card"><div>完成率</div><strong>${stats.completionRate}%</strong></div>
      <div class="card"><div>完成任务</div><strong>${stats.completedTasks}/${stats.totalTasks}</strong></div>
      <div class="card"><div>习惯打卡</div><strong>${stats.habitCheckins}</strong></div>
      <div class="card"><div>积分等级</div><strong>${stats.rewardPoints}</strong><div>${stats.rewardLevel.badge} ${stats.rewardLevel.title}</div></div>
    </div>
    <div class="card">
      <div>任务完成进度</div>
      <div class="bar"><span style="width:${stats.completionRate}%;"></span></div>
    </div>
    <h2>情绪与能量打卡</h2>
    <table>
      <thead><tr><th>日期</th><th>情绪</th><th>能量</th></tr></thead>
      <tbody>${moodRows}</tbody>
    </table>
    <h2>习惯打卡明细</h2>
    <table>
      <thead><tr><th>习惯</th><th>打卡情况</th><th>连续天数</th></tr></thead>
      <tbody>${habitRows}</tbody>
    </table>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `weekly-report-${getWeekStart()}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  document.documentElement.setAttribute('data-palette', currentPalette);
  localStorage.setItem('theme', currentTheme);
  localStorage.setItem('palette', currentPalette);
}

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme();
}

function setPalette(palette) {
  currentPalette = palette;
  applyTheme();
  render();
}

function getTodayIndex() {
  const today = new Date().getDay();
  return today === 0 ? 6 : today - 1;
}

function createTaskId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDueDate(dateString) {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-');
  if (!y || !m || !d) return dateString;
  return `${m}/${d}`;
}

function moveTaskToHour(taskId, toDay, toHour) {
  const tasksData = readJSON('weeklyTasks', normalizeWeeklyTasks({}));
  let found = null;
  for (let i = 0; i < 7; i++) {
    for (let h = 7; h < 24; h++) {
      const idx = tasksData[i][h].findIndex(t => String(t.id) === String(taskId));
      if (idx > -1) {
        found = tasksData[i][h][idx];
        tasksData[i][h].splice(idx, 1);
        break;
      }
    }
    if (found) break;
  }
  if (found) {
    tasksData[toDay][toHour].push(found);
    writeStorage('weeklyTasks', JSON.stringify(tasksData));
    render();
  }
}

function render() {
  try {
  const app = document.querySelector('#app');
  const today = getTodayIndex();
  const isMobileViewport = window.matchMedia('(max-width: 640px)').matches;
  const tasks = normalizeWeeklyTasks(readJSON('weeklyTasks', {}));
  const weeklyGoal = localStorage.getItem('weeklyGoal') || '';
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const habits = getHabits();
  const checkins = getWeeklyCheckins();
  const onboardingCompleted = localStorage.getItem('onboardingCompleted') === 'true';
  const moodTextMap = { happy: '开心', calm: '平静', tired: '疲惫', stressed: '焦虑', sick:'生病' };
  const energyTextMap = { high: '高', medium: '中', low: '低' };

  let totalTasks = 0;
  let completedTasks = 0;
  const dailyTasks = [];

  for (let i = 0; i < 7; i++) {
    let dayCount = 0;
    for (let h = 7; h < 24; h++) {
      const hourTasks = tasks[i][h] || [];
      dayCount += hourTasks.length;
      hourTasks.forEach(t => { if (t.completed) completedTasks++; });
    }
    dailyTasks.push(dayCount);
    totalTasks += dayCount;
  }

  const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;
  let highPriorityCount = 0;
  for (let i = 0; i < 7; i++) {
    for (let h = 7; h < 24; h++) {
      (tasks[i][h] || []).forEach(task => {
        if (task.priority === 'high') highPriorityCount++;
      });
    }
  }
  const habitCheckins = habits.reduce((acc, habit) => acc + habit.checks.filter(Boolean).length, 0);
  const bestHabitStreak = habits.reduce((best, habit) => Math.max(best, calculateHabitStreak(habit.checks)), 0);
  const rewardPoints = completedTasks * 10 + highPriorityCount * 5 + habitCheckins * 3;
  const rewardLevel = getRewardLevel(rewardPoints);
  const maxDailyTasks = Math.max(...dailyTasks, 1);
  const dailyEncouragements = [
    '“会当凌绝顶，一览众山小。” — 杜甫《望岳》',
    '“不经一番寒彻骨，怎得梅花扑鼻香。” — 朱熹',
    '“敏而好学，不耻下问。” — 孔子《论语》',
    '“不到长城非好汉，屈指行程二万。” — 毛泽东《清平乐·六盘山》',
    '“少壮不努力，老大徒伤悲。” — 佚名《长歌行》',
    '“苟日新，日日新，又日新。” — 《礼记·大学》',
    '“天行健，君子以自强不息。” — 《易经》'
  ];
  const encourageText = dailyEncouragements[new Date().getDate() % dailyEncouragements.length];
  const viewDays = isMobileViewport
    ? [selectedDay]
    : [(selectedDay + 6) % 7, selectedDay, (selectedDay + 1) % 7];
  const viewLabels = isMobileViewport
    ? [selectedDay === today ? '今天' : days[selectedDay]]
    : ['昨天', '今天', '明天'];

  app.innerHTML = `
    <div class="planner-shell">
      <header class="planner-header">
        <div class="day-switch-inner">
          <p class="planner-label">Weekly Planner</p>
          <h1>每周任务</h1>
        </div>
        <div class="planner-controls">
          <div class="backup-actions">
            <button id="export-app-data" class="bulk-btn">备份数据</button>
            <button id="import-app-data" class="bulk-btn">导入数据</button>
            <input id="import-app-data-input" type="file" accept="application/json" hidden>
          </div>
          <div class="palette-picker">
            <span class="palette-label">配色</span>
            <button type="button" class="palette-btn blue ${currentPalette === 'blue' ? 'active' : ''}" data-palette="blue" title="浅蓝"></button>
            <button type="button" class="palette-btn yellow ${currentPalette === 'yellow' ? 'active' : ''}" data-palette="yellow" title="浅黄色"></button>
            <button type="button" class="palette-btn green ${currentPalette === 'green' ? 'active' : ''}" data-palette="green" title="浅绿色"></button>
            <button type="button" class="palette-btn white ${currentPalette === 'white' ? 'active' : ''}" data-palette="white" title="经典白"></button>
          </div>
          <button id="theme-toggle" class="theme-btn" title="切换主题">
            ${currentTheme === 'light' ? '🌙' : '☀️'}
          </button>
          <div class="planner-status">
            <div class="status-card">
              <span>完成率</span>
              <strong>${completionRate}%</strong>
              <small>${completedTasks}/${totalTasks} 已完成</small>
            </div>
            <div class="status-card status-soft">
              <span>最高日任务</span>
              <strong>${Math.max(...dailyTasks)} 条</strong>
              <small>建议合理分配</small>
            </div>
            <div class="status-card">
              <span>本周积分</span>
              <strong>${rewardPoints}</strong>
              <small>${rewardLevel.badge} ${rewardLevel.title}</small>
            </div>
          </div>
        </div>
      </header>

      <section class="goal-panel">
        <div class="goal-card">
          <div class="goal-card-header">
            <h2>本周目标</h2>
            <span>输入后自动保存</span>
          </div>
          <textarea id="weekly-goal" class="weekly-goal-input" placeholder="你本周最重要的事情是什么？">${weeklyGoal}</textarea>
        </div>
        <div class="chart-card">
          <div class="search-section">
            <input type="text" id="task-search" class="search-input" placeholder="🔍 搜索任务..." value="${searchQuery}">
            <div class="filter-buttons">
              <button class="filter-btn ${selectedFilter === 'all' ? 'active' : ''}" data-filter="all">全部</button>
              <button class="filter-btn ${selectedFilter === 'pending' ? 'active' : ''}" data-filter="pending">未完成</button>
              <button class="filter-btn ${selectedFilter === 'completed' ? 'active' : ''}" data-filter="completed">已完成</button>
              <button class="filter-btn ${selectedFilter === 'high' ? 'active' : ''}" data-filter="high">高优先级</button>
            </div>
          </div>
          <div class="bulk-actions">
            <button id="select-all-btn" class="bulk-btn">全选</button>
            <button id="complete-selected-btn" class="bulk-btn">完成选中</button>
            <button id="delete-selected-btn" class="bulk-btn danger">删除选中</button>
            <span id="selected-count" class="selected-count">已选中 0 项</span>
          </div>
          <h2>每日报任务量</h2>
          <small class="chart-info">柱形图表示当天已添加任务数量，数值越高表示当天安排越满。</small>
          <div class="chart-bars"></div>
        </div>
      </section>

      <section class="habit-reward-panel">
        <div class="habit-card">
          <div class="goal-card-header">
            <h2>习惯打卡</h2>
            <div class="habit-inline-input">
              <input id="habit-name-input" type="text" placeholder="输入新习惯..." maxlength="40">
              <button id="add-habit-btn" class="bulk-btn">添加</button>
            </div>
          </div>
          <ul class="habit-list">
            ${habits.length === 0 ? '<li class="habit-empty">还没有习惯，先添加一个吧。</li>' : habits.map(habit => `
              <li class="habit-item">
                <span class="habit-name">${habit.name}</span>
                <div class="habit-check-row">
                  ${habit.checks.map((checked, dayIdx) => `
                    <button class="habit-check ${checked ? 'checked' : ''}" data-habit-id="${habit.id}" data-day-index="${dayIdx}">${dayLabels[dayIdx]}</button>
                  `).join('')}
                </div>
                <small class="habit-streak">连续 ${calculateHabitStreak(habit.checks)} 天</small>
              </li>
            `).join('')}
          </ul>
        </div>
        <div class="reward-card">
          <div class="goal-card-header">
            <h2>激励系统</h2>
            <button id="export-weekly-report" class="bulk-btn">导出可视化周报</button>
          </div>
          <div class="reward-overview">
            <p class="reward-level">${rewardLevel.badge} ${rewardLevel.title}</p>
            <p class="reward-points">${rewardPoints} 分</p>
            <p class="reward-detail">任务完成 + 高优任务 + 习惯打卡共同计分</p>
            <ul class="reward-rule-list">
              <li>每完成 1 个任务：+10 分</li>
              <li>每个高优先级任务：+5 分</li>
              <li>每次习惯打卡：+3 分</li>
            </ul>
          </div>
        </div>
      </section>
      <section class="checkin-panel">
        <div class="checkin-card">
          <div class="goal-card-header">
            <h2>情绪 + 能量打卡</h2>
            <span>记录后自动保存</span>
          </div>
          <div class="checkin-grid">
            <div class="checkin-row">
              <span>今天情绪</span>
              <div class="checkin-options">
                <button class="checkin-btn ${checkins.mood[today] === 'happy' ? 'active' : ''}" data-type="mood" data-value="happy">开心</button>
                <button class="checkin-btn ${checkins.mood[today] === 'calm' ? 'active' : ''}" data-type="mood" data-value="calm">平静</button>
                <button class="checkin-btn ${checkins.mood[today] === 'tired' ? 'active' : ''}" data-type="mood" data-value="tired">疲惫</button>
                <button class="checkin-btn ${checkins.mood[today] === 'stressed' ? 'active' : ''}" data-type="mood" data-value="stressed">焦虑</button>
                <button class="checkin-btn ${checkins.mood[today] === 'sick' ? 'active' : ''}" data-type="mood" data-value="sick">生病</button>
              </div>
            </div>
            <div class="checkin-row">
              <span>今天能量</span>
              <div class="checkin-options">
                <button class="checkin-btn ${checkins.energy[today] === 'high' ? 'active' : ''}" data-type="energy" data-value="high">高</button>
                <button class="checkin-btn ${checkins.energy[today] === 'medium' ? 'active' : ''}" data-type="energy" data-value="medium">中</button>
                <button class="checkin-btn ${checkins.energy[today] === 'low' ? 'active' : ''}" data-type="energy" data-value="low">低</button>
              </div>
            </div>
          </div>
          <p class="checkin-hint">今日状态：${moodTextMap[checkins.mood[today]] || '未选择'} / ${energyTextMap[checkins.energy[today]] || '未选择'}</p>
        </div>
      </section>
      <section class="mobile-day-tabs">
        ${days.map((label, idx) => `
          <button class="mobile-day-tab ${idx === selectedDay ? 'active' : ''}" data-mobile-day="${idx}">
            ${label}
          </button>
        `).join('')}
      </section>
      ${!onboardingCompleted ? `
      <section class="onboarding-panel">
        <div class="onboarding-card">
          <div class="goal-card-header">
            <h2>快速上手（3 步）</h2>
            <button id="skip-onboarding" class="bulk-btn">跳过</button>
          </div>
          <ol class="onboarding-list">
            <li><strong>添加一个任务：</strong>在任意时间段点击 <code>+</code> 创建本周任务。</li>
            <li><strong>记录今天状态：</strong>在“情绪 + 能量打卡”里点选一次今日状态。</li>
            <li><strong>导出一次周报：</strong>点击“导出可视化周报”生成你的第一份报告。</li>
          </ol>
          <div class="onboarding-actions">
            <button id="finish-onboarding" class="bulk-btn">我知道了，开始使用</button>
          </div>
        </div>
      </section>
      ` : ''}

      <section id="week-grid" class="week-grid"></section>
      <section class="nav-footer">
        <div class="nav-buttons">
          <button id="prev-day" class="nav-btn" aria-label="向前一天">←</button>
          <button id="today-btn" class="nav-btn primary" aria-label="返回今天">今天</button>
          <button id="next-day" class="nav-btn" aria-label="向后一天">→</button>
        </div>
      </section>
      <p class="encourage-text">${encourageText}</p>
    </div>
  `;

  const weekGrid = document.getElementById('week-grid');
  const chartBars = document.querySelector('.chart-bars');
  dailyTasks.forEach((count, idx) => {
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.innerHTML = `
      <strong class="bar-count">${count}</strong>
      <div class="bar-fill" style="height:${(count / maxDailyTasks) * 100}%"></div>
      <span>${days[idx].slice(1)}</span>
    `;
    chartBars.appendChild(bar);
  });

  viewDays.forEach((dayIndex, idx) => {
    const isToday = dayIndex === today;
    const col = document.createElement('div');
    col.className = 'day-col';
    if (isToday) col.classList.add('today-col');

    const title = document.createElement('div');
    title.className = 'day-title';
    title.innerHTML = `<span>${viewLabels[idx]} · ${days[dayIndex]}</span>${isToday ? '<strong>今天</strong>' : ''}`;
    col.appendChild(title);

    for (let h = 7; h < 24; h++) {
      const hourBlock = document.createElement('div');
      hourBlock.className = 'hour-block';
      hourBlock.dataset.day = dayIndex;
      hourBlock.dataset.hour = h;
      hourBlock.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      hourBlock.addEventListener('drop', e => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        moveTaskToHour(taskId, dayIndex, h);
      });

      const hourHeader = document.createElement('div');
      hourHeader.className = 'hour-header';
      hourHeader.innerHTML = `<span>${h}:00</span><button class="add-btn" data-day="${dayIndex}" data-hour="${h}">+</button>`;
      hourBlock.appendChild(hourHeader);

      const taskList = document.createElement('ul');
      taskList.className = 'task-list';
      let hourTasks = [...(tasks[dayIndex][h] || [])];

      // 应用搜索过滤
      if (searchQuery) {
        hourTasks = hourTasks.filter(task =>
          task.text.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // 应用状态过滤
      if (selectedFilter !== 'all') {
        switch (selectedFilter) {
          case 'pending':
          case 'active':
            hourTasks = hourTasks.filter(task => !task.completed);
            break;
          case 'completed':
            hourTasks = hourTasks.filter(task => task.completed);
            break;
          case 'high':
            hourTasks = hourTasks.filter(task => task.priority === 'high');
            break;
        }
      }

      // 按优先级排序：高 -> 中 -> 低
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      hourTasks.sort((a, b) => {
        const aPriority = priorityOrder[a.priority || 'medium'] || 2;
        const bPriority = priorityOrder[b.priority || 'medium'] || 2;
        return bPriority - aPriority;
      });

      const visibleTasks = hourTasks.filter(task => {
        if (selectedFilter === 'active') return !task.completed;
        if (selectedFilter === 'completed') return task.completed;
        return true;
      });

      visibleTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item priority-${task.priority || 'medium'}`;
        if (task.completed) li.classList.add('completed');
        const isOverdue = !!task.dueDate && !task.completed && task.dueDate < getTodayDateString();
        if (isOverdue) li.classList.add('overdue');
        li.draggable = true;
        li.addEventListener('dragstart', e => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', task.id);
        });

        const selectCheckbox = document.createElement('input');
        selectCheckbox.type = 'checkbox';
        selectCheckbox.className = 'task-select';
        selectCheckbox.checked = selectedTasks.has(task.id);
        selectCheckbox.dataset.id = task.id;
        selectCheckbox.addEventListener('change', e => {
          if (e.target.checked) {
            selectedTasks.add(task.id);
          } else {
            selectedTasks.delete(task.id);
          }
          updateSelectedCount();
        });

        const priorityIndicator = document.createElement('div');
        priorityIndicator.className = 'priority-indicator';
        priorityIndicator.title = `优先级：${task.priority === 'high' ? '高' : task.priority === 'low' ? '低' : '中'}`;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.className = 'task-check';
        checkbox.dataset.day = dayIndex;
        checkbox.dataset.hour = h;
        checkbox.dataset.id = task.id;
        checkbox.addEventListener('change', e => {
          const day = parseInt(e.target.dataset.day, 10);
          const hour = parseInt(e.target.dataset.hour, 10);
          const id = e.target.dataset.id;
          const tasksData = readJSON('weeklyTasks', normalizeWeeklyTasks({}));
          const taskItem = tasksData[day][hour].find(t => String(t.id) === String(id));
          if (taskItem) {
            taskItem.completed = e.target.checked;
            writeStorage('weeklyTasks', JSON.stringify(tasksData));
            render();
          }
        });

        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = task.text;
        taskText.dataset.day = dayIndex;
        taskText.dataset.hour = h;
        taskText.dataset.id = task.id;
        taskText.title = '双击编辑任务';
        taskText.addEventListener('dblclick', () => {
          taskText.contentEditable = 'true';
          taskText.classList.add('editing');
          taskText.focus();
        });
        taskText.addEventListener('blur', () => {
          if (!taskText.isContentEditable) return;
          taskText.contentEditable = 'false';
          taskText.classList.remove('editing');
          const newText = taskText.textContent.trim();
          if (newText.length === 0) {
            render();
            return;
          }
          const tasksData = readJSON('weeklyTasks', normalizeWeeklyTasks({}));
          const taskItem = tasksData[dayIndex][h].find(t => String(t.id) === String(task.id));
          if (taskItem) {
            taskItem.text = newText;
            writeStorage('weeklyTasks', JSON.stringify(tasksData));
            render();
          }
        });
        taskText.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            taskText.blur();
          }
        });

        const dueBadge = document.createElement('span');
        dueBadge.className = `due-badge ${isOverdue ? 'overdue' : ''}`;
        if (task.dueDate) {
          dueBadge.textContent = isOverdue
            ? `已逾期 ${formatDueDate(task.dueDate)}`
            : `截止 ${formatDueDate(task.dueDate)}`;
          dueBadge.title = `截止日期：${task.dueDate}`;
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.dataset.day = dayIndex;
        deleteButton.dataset.hour = h;
        deleteButton.dataset.id = task.id;
        deleteButton.textContent = '✕';
        deleteButton.addEventListener('click', e => {
          const day = parseInt(e.target.dataset.day, 10);
          const hour = parseInt(e.target.dataset.hour, 10);
          const id = e.target.dataset.id;
          const tasksData = readJSON('weeklyTasks', normalizeWeeklyTasks({}));
          tasksData[day][hour] = tasksData[day][hour].filter(t => String(t.id) !== String(id));
          writeStorage('weeklyTasks', JSON.stringify(tasksData));
          render();
        });

        li.appendChild(selectCheckbox);
        li.appendChild(priorityIndicator);
        li.appendChild(checkbox);
        li.appendChild(taskText);
        if (task.dueDate) li.appendChild(dueBadge);
        li.appendChild(deleteButton);
        taskList.appendChild(li);
      });

      hourBlock.appendChild(taskList);
      col.appendChild(hourBlock);
    }

    weekGrid.appendChild(col);
  });

  const weeklyGoalInput = document.getElementById('weekly-goal');
  weeklyGoalInput.addEventListener('input', e => {
    writeStorage('weeklyGoal', e.target.value);
  });

  document.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const day = parseInt(e.target.dataset.day, 10);
      const hour = parseInt(e.target.dataset.hour, 10);

      // 创建优先级选择对话框
      const priorityDialog = document.createElement('div');
      priorityDialog.className = 'priority-dialog-overlay';
      priorityDialog.innerHTML = `
        <div class="priority-dialog">
          <h3>添加新任务</h3>
          <input type="text" id="task-text" placeholder="请输入任务内容" maxlength="100">
          <div class="priority-selector">
            <label>优先级：</label>
            <div class="priority-options">
              <button class="priority-btn low" data-priority="low">低</button>
              <button class="priority-btn medium active" data-priority="medium">中</button>
              <button class="priority-btn high" data-priority="high">高</button>
            </div>
          </div>
          <div class="date-selector">
            <label for="task-due-date">截止日期（可选）：</label>
            <input type="date" id="task-due-date">
          </div>
          <div class="dialog-buttons">
            <button id="cancel-task">取消</button>
            <button id="confirm-task">确定</button>
          </div>
        </div>
      `;

      document.body.appendChild(priorityDialog);

      const textInput = priorityDialog.querySelector('#task-text');
      const dueDateInput = priorityDialog.querySelector('#task-due-date');
      let selectedPriority = 'medium';

      // 优先级选择
      priorityDialog.querySelectorAll('.priority-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          priorityDialog.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedPriority = btn.dataset.priority;
        });
      });

      // 取消
      priorityDialog.querySelector('#cancel-task').addEventListener('click', () => {
        document.body.removeChild(priorityDialog);
      });

      // 确定
      priorityDialog.querySelector('#confirm-task').addEventListener('click', () => {
        const text = textInput.value.trim();
        if (text) {
          const tasksData = readJSON('weeklyTasks', normalizeWeeklyTasks({}));
          tasksData[day][hour].push({
            id: createTaskId(),
            text,
            completed: false,
            priority: selectedPriority,
            dueDate: dueDateInput.value || ''
          });
          writeStorage('weeklyTasks', JSON.stringify(tasksData));
          render();
        }
        document.body.removeChild(priorityDialog);
      });

      // 回车确认
      textInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          priorityDialog.querySelector('#confirm-task').click();
        }
      });

      textInput.focus();
    });
  });

  const prevBtn = document.getElementById('prev-day');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      selectedDay = (selectedDay + 6) % 7;
      render();
    });
  }

  const todayBtn = document.getElementById('today-btn');
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      selectedDay = getTodayIndex();
      render();
    });
  }

  const nextBtn = document.getElementById('next-day');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      selectedDay = (selectedDay + 1) % 7;
      render();
    });
  }

  document.querySelectorAll('.mobile-day-tab').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.target.dataset.mobileDay || '-1', 10);
      if (idx < 0 || idx > 6) return;
      selectedDay = idx;
      render();
    });
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      selectedFilter = e.target.dataset.filter || 'all';
      render();
    });
  });

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      toggleTheme();
      render();
    });
  }

  document.querySelectorAll('.palette-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const palette = e.target.dataset.palette;
      if (palette) setPalette(palette);
    });
  });

  const searchInput = document.getElementById('task-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value;
      render();
    });
  }

  const exportDataBtn = document.getElementById('export-app-data');
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
      exportAppData();
      showNotification('完整数据已导出');
    });
  }

  const importDataBtn = document.getElementById('import-app-data');
  const importDataInput = document.getElementById('import-app-data-input');
  if (importDataBtn && importDataInput) {
    importDataBtn.addEventListener('click', () => importDataInput.click());
    importDataInput.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) importAppDataFromFile(file);
      e.target.value = '';
    });
  }

  // 批量操作按钮
  const selectAllBtn = document.getElementById('select-all-btn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', selectAllTasks);
  }

  const completeSelectedBtn = document.getElementById('complete-selected-btn');
  if (completeSelectedBtn) {
    completeSelectedBtn.addEventListener('click', bulkCompleteTasks);
  }

  const deleteSelectedBtn = document.getElementById('delete-selected-btn');
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', bulkDeleteTasks);
  }

  const addHabitBtn = document.getElementById('add-habit-btn');
  if (addHabitBtn) {
    addHabitBtn.addEventListener('click', () => {
      const input = document.getElementById('habit-name-input');
      const name = input ? input.value.trim() : '';
      if (!name) return;
      const habitsData = getHabits();
      habitsData.push({
        id: createTaskId(),
        name,
        checks: [false, false, false, false, false, false, false]
      });
      saveHabits(habitsData);
      if (input) input.value = '';
      render();
    });
  }

  const habitInput = document.getElementById('habit-name-input');
  if (habitInput) {
    habitInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const addBtn = document.getElementById('add-habit-btn');
        if (addBtn) addBtn.click();
      }
    });
  }

  document.querySelectorAll('.habit-check').forEach(btn => {
    btn.addEventListener('click', e => {
      const habitId = e.target.dataset.habitId;
      const dayIndex = parseInt(e.target.dataset.dayIndex || '-1', 10);
      if (!habitId || dayIndex < 0 || dayIndex > 6) return;
      const habitsData = getHabits();
      const targetHabit = habitsData.find(habit => String(habit.id) === String(habitId));
      if (!targetHabit) return;
      targetHabit.checks[dayIndex] = !targetHabit.checks[dayIndex];
      saveHabits(habitsData);
      render();
    });
  });

  const exportBtn = document.getElementById('export-weekly-report');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportWeeklyReport(tasks, habits, {
        totalTasks,
        completedTasks,
        completionRate,
        highPriorityCount,
        habitCheckins,
        bestHabitStreak,
        rewardPoints,
        rewardLevel
      }, checkins);
      showNotification('可视化周报已导出到下载目录');
    });
  }

  document.querySelectorAll('.checkin-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const type = e.target.dataset.type;
      const value = e.target.dataset.value;
      const data = getWeeklyCheckins();
      if (type === 'mood') data.mood[today] = value;
      if (type === 'energy') data.energy[today] = value;
      saveWeeklyCheckins(data);
      render();
    });
  });

  const finishOnboardingBtn = document.getElementById('finish-onboarding');
  if (finishOnboardingBtn) {
    finishOnboardingBtn.addEventListener('click', () => {
      localStorage.setItem('onboardingCompleted', 'true');
      render();
      showNotification('欢迎使用！你可以开始安排这周计划了');
    });
  }

  const skipOnboardingBtn = document.getElementById('skip-onboarding');
  if (skipOnboardingBtn) {
    skipOnboardingBtn.addEventListener('click', () => {
      localStorage.setItem('onboardingCompleted', 'true');
      render();
    });
  }

  // 更新选中任务数量显示
  updateSelectedCount();
  } catch (error) {
    const app = document.querySelector('#app');
    if (!app) return;
    app.innerHTML = `
      <div class="planner-shell">
        <section class="onboarding-card">
          <h2>数据异常，已进入安全恢复模式</h2>
          <p class="checkin-hint">点击下方按钮可重置异常数据并继续使用。</p>
          <div class="onboarding-actions">
            <button id="safe-reset-data" class="bulk-btn">恢复默认数据</button>
          </div>
        </section>
      </div>
    `;
    const resetBtn = document.getElementById('safe-reset-data');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        writeStorage('weeklyTasks', JSON.stringify(normalizeWeeklyTasks({})));
        writeStorage('weeklyHabits', JSON.stringify([]));
        writeStorage('weeklyCheckins', JSON.stringify({ mood: Array(7).fill(''), energy: Array(7).fill('') }));
        writeStorage('weeklyGoal', '');
        selectedTasks.clear();
        render();
      });
    }
  }
}

function updateSelectedCount() {
  const countElement = document.getElementById('selected-count');
  if (countElement) {
    countElement.textContent = `已选中 ${selectedTasks.size} 项`;
  }
}

function bulkCompleteTasks() {
  if (selectedTasks.size === 0) return;

  const tasksData = readJSON('weeklyTasks', normalizeWeeklyTasks({}));
  let completedCount = 0;

  for (let day = 0; day < 7; day++) {
    for (let hour = 7; hour < 24; hour++) {
      const hourTasks = tasksData[day][hour] || [];
      hourTasks.forEach(task => {
        if (selectedTasks.has(task.id) && !task.completed) {
          task.completed = true;
          completedCount++;
        }
      });
    }
  }

  writeStorage('weeklyTasks', JSON.stringify(tasksData));
  selectedTasks.clear();
  render();

  if (completedCount > 0) {
    showNotification(`成功完成 ${completedCount} 个任务！`);
  }
}

function bulkDeleteTasks() {
  if (selectedTasks.size === 0) return;

  if (!confirm(`确定要删除选中的 ${selectedTasks.size} 个任务吗？此操作不可撤销。`)) {
    return;
  }

  const tasksData = readJSON('weeklyTasks', normalizeWeeklyTasks({}));
  let deletedCount = 0;

  for (let day = 0; day < 7; day++) {
    for (let hour = 7; hour < 24; hour++) {
      const originalTasks = tasksData[day][hour] || [];
      tasksData[day][hour] = originalTasks.filter(task => !selectedTasks.has(task.id));
      deletedCount += originalTasks.length - tasksData[day][hour].length;
    }
  }

  writeStorage('weeklyTasks', JSON.stringify(tasksData));
  selectedTasks.clear();
  render();

  if (deletedCount > 0) {
    showNotification(`成功删除 ${deletedCount} 个任务！`);
  }
}

function selectAllTasks() {
  const allTaskIds = new Set();

  const tasks = normalizeWeeklyTasks(readJSON('weeklyTasks', {}));
  for (let day = 0; day < 7; day++) {
    for (let hour = 7; hour < 24; hour++) {
      const hourTasks = tasks[day][hour] || [];
      const filteredTasks = hourTasks.filter(task => {
        // 应用当前搜索和过滤条件
        if (searchQuery && !task.text.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        if (selectedFilter !== 'all') {
          switch (selectedFilter) {
            case 'pending':
            case 'active':
              return !task.completed;
            case 'completed':
              return task.completed;
            case 'high':
              return task.priority === 'high';
          }
        }
        return true;
      });
      filteredTasks.forEach(task => allTaskIds.add(task.id));
    }
  }

  selectedTasks = allTaskIds;
  render();
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

initStorage();
selectedDay = getTodayIndex();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Ignore registration failures to avoid blocking the app.
    });
  });
}
