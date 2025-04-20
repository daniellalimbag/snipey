import sys
import os
import subprocess
import pkg_resources
import platform

required_packages = [
    'requests',
    'beautifulsoup4',
    'seleniumbase',
    'selenium',
]

def get_pip_cmd():
    """Get the appropriate pip command"""
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        if platform.system() == 'Windows':
            return [sys.executable, '-m', 'pip']
        else:
            return [sys.executable, '-m', 'pip']
    else:
        return [sys.executable, '-m', 'pip']

def install_missing_packages():
    """Check and install missing packages"""
    pip_cmd = get_pip_cmd()
    print(f"Using pip command: {' '.join(pip_cmd)}")
    
    installed = {pkg.key for pkg in pkg_resources.working_set}
    missing = [pkg for pkg in required_packages if pkg.lower() not in installed]
    
    if missing:
        print(f"Installing missing packages: {missing}")
        try:
            subprocess.check_call(pip_cmd + ['install'] + missing)
            print("Successfully installed missing packages")
        except subprocess.CalledProcessError as e:
            print(f"Error installing packages: {e}")
            return False
    else:
        print("All required packages are already installed")
    
    return True

if __name__ == "__main__":
    try:
        print(f"Python version: {sys.version}")
        print(f"Python executable: {sys.executable}")
        print(f"Platform: {platform.platform()}")
        
        pip_cmd = get_pip_cmd()
        subprocess.check_call(pip_cmd + ['install', '--upgrade', 'pip'])
        
        if install_missing_packages():
            print("Python environment setup complete!")
        else:
            print("Failed to set up Python environment")
            sys.exit(1)
    except Exception as e:
        print(f"Error setting up Python environment: {e}")
        sys.exit(1)