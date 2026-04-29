import './style.css'

let selectedDay = null;

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
          priority: task.priority || 'medium' // 默认中等优先级
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
    localStorage.setItem('weeklyTasks', JSON.stringify(normalizeWeeklyTasks({})));
  } else {
    const parsed = normalizeWeeklyTasks(JSON.parse(existing));
    localStorage.setItem('weeklyTasks', JSON.stringify(parsed));
  }
  if (!localStorage.getItem('weeklyGoal')) {
    localStorage.setItem('weeklyGoal', '');
  }
}

function getTodayIndex() {
  const today = new Date().getDay();
  return today === 0 ? 6 : today - 1;
}

function createTaskId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function moveTaskToHour(taskId, toDay, toHour) {
  const tasksData = JSON.parse(localStorage.getItem('weeklyTasks'));
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
    localStorage.setItem('weeklyTasks', JSON.stringify(tasksData));
    render();
  }
}

function render() {
  const app = document.querySelector('#app');
  const today = getTodayIndex();
  const tasks = JSON.parse(localStorage.getItem('weeklyTasks'));
  const weeklyGoal = localStorage.getItem('weeklyGoal') || '';
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

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
  const viewDays = [
    (selectedDay + 6) % 7,
    selectedDay,
    (selectedDay + 1) % 7
  ];
  const viewLabels = ['昨天', '今天', '明天'];

  app.innerHTML = `
    <div class="planner-shell">
      <header class="planner-header">
        <div class="day-switch-inner">
          <p class="planner-label">Weekly Planner</p>
          <h1>每周任务</h1>
        </div>
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
          <h2>每日报任务量</h2>
          <small class="chart-info">柱形图表示当天已添加任务数量，数值越高表示当天安排越满。</small>
          <div class="chart-bars"></div>
        </div>
      </section>

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
      const hourTasks = tasks[dayIndex][h] || [];

      // 按优先级排序：高 -> 中 -> 低
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      hourTasks.sort((a, b) => {
        const aPriority = priorityOrder[a.priority || 'medium'] || 2;
        const bPriority = priorityOrder[b.priority || 'medium'] || 2;
        return bPriority - aPriority;
      });

      hourTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item priority-${task.priority || 'medium'}`;
        if (task.completed) li.classList.add('completed');
        li.draggable = true;
        li.addEventListener('dragstart', e => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', task.id);
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
          const tasksData = JSON.parse(localStorage.getItem('weeklyTasks'));
          const taskItem = tasksData[day][hour].find(t => String(t.id) === String(id));
          if (taskItem) {
            taskItem.completed = e.target.checked;
            localStorage.setItem('weeklyTasks', JSON.stringify(tasksData));
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
          const tasksData = JSON.parse(localStorage.getItem('weeklyTasks'));
          const taskItem = tasksData[dayIndex][h].find(t => String(t.id) === String(task.id));
          if (taskItem) {
            taskItem.text = newText;
            localStorage.setItem('weeklyTasks', JSON.stringify(tasksData));
            render();
          }
        });
        taskText.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            taskText.blur();
          }
        });

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
          const tasksData = JSON.parse(localStorage.getItem('weeklyTasks'));
          tasksData[day][hour] = tasksData[day][hour].filter(t => String(t.id) !== String(id));
          localStorage.setItem('weeklyTasks', JSON.stringify(tasksData));
          render();
        });

        li.appendChild(priorityIndicator);
        li.appendChild(checkbox);
        li.appendChild(taskText);
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
    localStorage.setItem('weeklyGoal', e.target.value);
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
          <div class="dialog-buttons">
            <button id="cancel-task">取消</button>
            <button id="confirm-task">确定</button>
          </div>
        </div>
      `;

      document.body.appendChild(priorityDialog);

      const textInput = priorityDialog.querySelector('#task-text');
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
          const tasksData = JSON.parse(localStorage.getItem('weeklyTasks'));
          tasksData[day][hour].push({
            id: createTaskId(),
            text,
            completed: false,
            priority: selectedPriority
          });
          localStorage.setItem('weeklyTasks', JSON.stringify(tasksData));
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
}

initStorage();
selectedDay = getTodayIndex();
render();
