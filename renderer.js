const { ipcRenderer } = require('electron');
const credentials = require('./config/credentials.json');

const dlsuIdInput = document.getElementById('dlsu-id');
const refreshIntervalInput = document.getElementById('refresh-interval');
const headlessModeCheckbox = document.getElementById('headless-mode');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const outputDiv = document.getElementById('output');
const notification = document.getElementById('notification');
const notificationContent = document.getElementById('notification-content');
const notificationList = document.getElementById('notification-list');
const addCourseBtn = document.getElementById('add-course-btn');
const courseEntries = document.getElementById('course-entries');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const accessKeyInput = document.getElementById('access-key');
const clearLogsBtn = document.getElementById('clear-logs-btn');

const discordEnabledCheckbox = document.getElementById('discord-enabled');
const discordChannelInput = document.getElementById('discord-channel-id');
const saveDiscordBtn = document.getElementById('save-discord-settings');
const discordStatus = document.getElementById('discord-status');

const courseEntryTemplate = document.getElementById('course-entry-template');
const classEntryTemplate = document.getElementById('class-entry-template');

const availableClasses = {};

function initDarkMode() {
  const savedTheme = localStorage.getItem('darkMode');
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  
  if (savedTheme === 'true') {
    document.body.classList.add('dark-mode');
    darkModeToggle.checked = true;
  } else if (savedTheme === 'false') {
    document.body.classList.remove('dark-mode');
    darkModeToggle.checked = false;
  } else if (prefersDarkScheme.matches) {
    document.body.classList.add('dark-mode');
    darkModeToggle.checked = true;
  }
  
  darkModeToggle.addEventListener('change', function() {
    if (this.checked) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('darkMode', 'false');
    }
  });
}

function addLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.textContent = `[${timestamp}] ${message}`;
  outputDiv.appendChild(logEntry);
  outputDiv.scrollTop = outputDiv.scrollHeight;
}

function addCourseEntry() {
  const courseEntryClone = document.importNode(courseEntryTemplate.content, true);
  const courseEntry = courseEntryClone.querySelector('.course-entry');
  
  courseEntry.querySelector('.remove-course-btn').addEventListener('click', function() {
    courseEntry.remove();
  });
  
  courseEntry.querySelector('.add-class-btn').addEventListener('click', function() {
    addClassEntry(courseEntry.querySelector('.class-entries'));
  });
  
  courseEntries.appendChild(courseEntry);
  
  addClassEntry(courseEntry.querySelector('.class-entries'));
  
  return courseEntry;
}

function addClassEntry(classEntriesContainer) {
  const classEntryClone = document.importNode(classEntryTemplate.content, true);
  const classEntry = classEntryClone.querySelector('.class-entry');
  
  classEntry.querySelector('.remove-class-btn').addEventListener('click', function() {
    classEntry.remove();
  });
  
  classEntriesContainer.appendChild(classEntry);
  
  return classEntry;
}

function collectCourseClassPairs() {
  const pairs = {};
  
  document.querySelectorAll('.course-entry').forEach(courseEntry => {
    const courseCode = courseEntry.querySelector('.course-code').value.trim().toUpperCase();
    
    if (courseCode) {
      pairs[courseCode] = [];
      
      courseEntry.querySelectorAll('.class-entry').forEach(classEntry => {
        const classCode = classEntry.querySelector('.class-code').value.trim();
        
        if (classCode) {
          pairs[courseCode].push(classCode);
        }
      });
      
      if (pairs[courseCode].length === 0) {
        delete pairs[courseCode];
      }
    }
  });
  
  return pairs;
}

function initializeUI() {
  addCourseBtn.addEventListener('click', addCourseEntry);
  
  addCourseEntry();
  initDarkMode();
  loadDiscordSettings();
  loadAccessKey();
  saveDiscordBtn.addEventListener('click', saveDiscordSettings);
  discordEnabledCheckbox.addEventListener('change', updateDiscordFieldsState);
  updateDiscordFieldsState();
  
  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
      outputDiv.innerHTML = '';
    });
  }
}

function updateDiscordFieldsState() {
  const enabled = discordEnabledCheckbox.checked;
  discordChannelInput.disabled = !enabled;
  saveDiscordBtn.disabled = !enabled;
}

function loadDiscordSettings() {
  const settings = JSON.parse(localStorage.getItem('discordSettings') || '{}');
  
  if (settings.channelId) {
    discordChannelInput.value = settings.channelId;
  }
  
  discordEnabledCheckbox.checked = !!settings.enabled;
  updateDiscordFieldsState();
}

function saveDiscordSettings() {
  const channelId = discordChannelInput.value.trim();
  const enabled = discordEnabledCheckbox.checked;
  
  // Save settings (no token needed)
  const settings = { channelId, enabled };
  localStorage.setItem('discordSettings', JSON.stringify(settings));
  
  // Setup Discord bot
  ipcRenderer.send('setup-discord', settings);
  
  discordStatus.textContent = 'Setting up Discord bot...';
  discordStatus.classList.remove('success', 'error');
  discordStatus.classList.add('pending');
}

function loadAccessKey() {
  const key = localStorage.getItem('accessKey') || '';
  accessKeyInput.value = key;
}

function saveAccessKey() {
  const key = accessKeyInput.value.trim();
  if (key) {
    localStorage.setItem('accessKey', key);
  }
}

function showCustomAlert(msg) {
  const modal = document.getElementById('custom-alert');
  document.getElementById('custom-alert-message').textContent = msg;
  modal.classList.remove('hidden');
}
function hideCustomAlert() {
  document.getElementById('custom-alert').classList.add('hidden');
}
document.getElementById('custom-alert-ok').addEventListener('click', hideCustomAlert);

ipcRenderer.on('discord-status', (event, result) => {
  if (result.success) {
    if (result.enabled) {
      discordStatus.textContent = 'Discord bot connected successfully!';
      discordStatus.classList.remove('pending', 'error');
      discordStatus.classList.add('success');
    } else {
      discordStatus.textContent = 'Discord notifications disabled';
      discordStatus.classList.remove('pending', 'error', 'success');
    }
  } else {
    discordStatus.textContent = `Error: ${result.error}`;
    discordStatus.classList.remove('pending', 'success');
    discordStatus.classList.add('error');
  }
});

function showNotification(availableCourses) {
  notification.classList.remove('hidden');
  
  notificationList.innerHTML = '';
  
  for (const [courseCode, classCodes] of Object.entries(availableCourses)) {
    classCodes.forEach(classCode => {
      const item = document.createElement('li');
      item.textContent = `${courseCode}-${classCode}`;
      notificationList.appendChild(item);
    });
  }
  
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 20000);
}

function hideNotification() {
  notification.classList.add('hidden');
}

startBtn.addEventListener('click', () => {
  const accessKey = accessKeyInput.value.trim();
  if (!accessKey) {
    showCustomAlert('Please enter access key.');
    addLog('Please enter access key.');
    return;
  }
  if (accessKey !== credentials.access_key) {
    showCustomAlert('Invalid access key.');
    addLog('Invalid access key.');
    return;
  }
  saveAccessKey();
  const dlsuId = dlsuIdInput.value.trim();
  const refreshInterval = parseInt(refreshIntervalInput.value);
  const headlessMode = headlessModeCheckbox.checked;
  const courseClassPairs = collectCourseClassPairs();
  
  if (!dlsuId) {
    addLog('Please enter your DLSU ID.');
    return;
  }
  
  if (Object.keys(courseClassPairs).length === 0) {
    addLog('Please add at least one course and class code.');
    return;
  }
  
  if (refreshInterval < 5) {
    addLog('Refresh interval should be at least 5 seconds.');
    return;
  }
  
  Object.keys(availableClasses).forEach(key => delete availableClasses[key]);
  
  const config = {
    access_key: accessKey,
    dlsu_id: dlsuId,
    refresh_interval: refreshInterval,
    headless: headlessMode,
    course_class_pairs: courseClassPairs
  };
  
  ipcRenderer.send('start-check', config);
  
  startBtn.disabled = true;
  stopBtn.disabled = false;
  notification.classList.add('hidden');
  addLog('Starting check for multiple courses and classes...');
  
  for (const [course, classes] of Object.entries(courseClassPairs)) {
    addLog(`Monitoring ${course}: ${classes.join(', ')}`);
  }
});

stopBtn.addEventListener('click', () => {
  ipcRenderer.send('stop-check');
});

ipcRenderer.on('log-message', (event, message) => {
  addLog(message);
});

ipcRenderer.on('class-available', (event, data) => {
  if (data && data.courseCode && data.classCode) {
    if (!availableClasses[data.courseCode]) {
      availableClasses[data.courseCode] = [];
    }
    
    if (!availableClasses[data.courseCode].includes(data.classCode)) {
      availableClasses[data.courseCode].push(data.classCode);
      
      playNotificationSound();
      
      showNotification(availableClasses);
    }
  } else {
    showNotification(availableClasses);
    playNotificationSound();
  }
});

ipcRenderer.on('check-ended', (event) => {
  startBtn.disabled = false;
  stopBtn.disabled = true;
});

function playNotificationSound() {
  const audio = new Audio('notify.mp3');
  audio.play();
}

// close notification button
document.getElementById('close-notification').addEventListener('click', hideNotification);

document.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  addLog('DLSU Course Checker started. Ready to check course availability.');
  addLog('Enter your details and click "Start Checking".');

  if (Notification.permission !== 'granted') {
    Notification.requestPermission().then(permission => {
      if (permission !== 'granted') {
        addLog('Please enable notification permissions for this application.');
      }
    });
  }
  
  // initialize Discord bot if enabled
  const discordSettings = JSON.parse(localStorage.getItem('discordSettings') || '{}');
  if (discordSettings.enabled) {
    ipcRenderer.send('setup-discord', discordSettings);
  }
});
