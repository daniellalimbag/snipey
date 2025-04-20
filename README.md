# 🕸️ MLS Web Scraper

Yipee Electron and Selenium!

---

## 🛠️ Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/daniellalimbag/MLS-Web-Scraper.git
cd MLS-Web-Scraper
```

### 2. Install Node.js dependencies
```bash
npm install
npm install discord.js
```

### 3. Install Python dependencies  
Make sure you have Python 3 installed. Then run:
```bash
pip install seleniumbase
```

### 4. Start the app
```bash
npm start
```

#### 🚨 If Electron is not recognized:

If running `npm start` results in an error like:

> `'electron' is not recognized as an internal or external command`

Follow these steps:

1. **Install Electron locally** by running:
   ```bash
   npm install electron --save-dev
   ```

2. After installation, try starting the app again:
   ```bash
   npm start
   ```

---

## 🧠 Requirements
- [Node.js](https://nodejs.org/)  
- [Python 3](https://www.python.org/)  
- [SeleniumBase](https://seleniumbase.io/)

---

## 🚧 Notes
- Make sure Chrome is installed on your system. SeleniumBase uses it by default for headless automation.
- You may need to allow permissions or update `chromedriver` depending on your OS.