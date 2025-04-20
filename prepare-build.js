const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// create a directory for the Python distribution
const pythonDistDir = path.join(__dirname, 'python-dist');
if (fs.existsSync(pythonDistDir)) {
  console.log('Cleaning existing Python distribution...');
  fs.rmSync(pythonDistDir, { recursive: true, force: true });
}
fs.mkdirSync(pythonDistDir, { recursive: true });

// create requirements file if it doesn't exist
const reqFile = path.join(__dirname, 'requirements.txt');
if (!fs.existsSync(reqFile)) {
  console.log('Creating requirements.txt...');
  fs.writeFileSync(reqFile, 'seleniumbase\nrequests\nbeautifulsoup4\n');
}

// create python virtual environment
console.log('Creating Python virtual environment...');
try {
  const venvDir = path.join(__dirname, 'python-venv');
  if (fs.existsSync(venvDir)) {
    console.log('Removing existing virtual environment...');
    fs.rmSync(venvDir, { recursive: true, force: true });
  }
  
  execSync('python -m venv python-venv', { stdio: 'inherit' });
  
  const pipCmd = process.platform === 'win32' ? 
    path.join('python-venv', 'Scripts', 'pip') : 
    path.join('./python-venv', 'bin', 'pip');
  
  const pythonCmd = process.platform === 'win32' ? 
    path.join('python-venv', 'Scripts', 'python') : 
    path.join('./python-venv', 'bin', 'python');
  
  console.log('Upgrading pip...');
  execSync(`${pythonCmd} -m pip install --upgrade pip`, { stdio: 'inherit' });
  
  console.log('Installing Python dependencies...');
  execSync(`${pythonCmd} -m pip install -r requirements.txt`, { stdio: 'inherit' });
  
  const scriptDir = path.join(__dirname, 'script');
  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir, { recursive: true });
  }
  
  const verifyScript = path.join(scriptDir, 'verify_env.py');
  fs.writeFileSync(verifyScript, `
import sys
import os
import platform
import pkg_resources

def main():
    """Verify Python environment and print diagnostics"""
    print("Python Environment Verification")
    print("-" * 30)
    print(f"Python Version: {sys.version}")
    print(f"Python Executable: {sys.executable}")
    print(f"Operating System: {platform.system()} {platform.release()}")
    print(f"Platform: {platform.platform()}")
    print(f"Architecture: {platform.architecture()[0]}")
    
    print("\\nInstalled Packages:")
    packages = sorted([f"{pkg.key}=={pkg.version}" for pkg in pkg_resources.working_set])
    for package in packages:
        print(f"  {package}")
    
    print("\\nCurrent Working Directory:")
    print(f"  {os.getcwd()}")
    
    print("\\nScript Directory:")
    print(f"  {os.path.dirname(os.path.abspath(__file__))}")
    
    try:
        print("\\nTesting import of required modules:")
        modules_to_test = ['requests', 'bs4', 'selenium', 'seleniumbase']
        
        for module in modules_to_test:
            try:
                __import__(module)
                print(f"  ✓ {module} imported successfully")
            except ImportError as e:
                print(f"  ✗ {module} import failed: {e}")
    except Exception as e:
        print(f"Error testing imports: {e}")
    
    print("\\nVerification Complete")

if __name__ == "__main__":
    main()
`);
  
  console.log('Copying Python environment to distribution...');
  
  const distScriptDir = path.join(pythonDistDir, 'script');
  if (!fs.existsSync(distScriptDir)) {
    fs.mkdirSync(distScriptDir, { recursive: true });
  }
  
  fs.readdirSync(scriptDir).forEach(file => {
    if (file.endsWith('.py')) {
      fs.copyFileSync(
        path.join(scriptDir, file),
        path.join(distScriptDir, file)
      );
    }
  });
  
  const distVenvDir = path.join(pythonDistDir, 'python-venv');
  
  if (process.platform === 'win32') {
    console.log(`Copying venv from ${venvDir} to ${distVenvDir}`);
    execSync(`xcopy "${venvDir}" "${distVenvDir}" /E /I /H /Y`, { stdio: 'inherit' });
  } else {
    execSync(`cp -R "${venvDir}" "${distVenvDir}"`, { stdio: 'inherit' });
  }
  
  console.log('Done preparing build environment!');
} catch (error) {
  console.error('Error preparing build:', error);
  process.exit(1);
}