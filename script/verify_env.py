
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
    
    print("\nInstalled Packages:")
    packages = sorted([f"{pkg.key}=={pkg.version}" for pkg in pkg_resources.working_set])
    for package in packages:
        print(f"  {package}")
    
    print("\nCurrent Working Directory:")
    print(f"  {os.getcwd()}")
    
    print("\nScript Directory:")
    print(f"  {os.path.dirname(os.path.abspath(__file__))}")
    
    try:
        print("\nTesting import of required modules:")
        modules_to_test = ['requests', 'bs4', 'selenium', 'seleniumbase']
        
        for module in modules_to_test:
            try:
                __import__(module)
                print(f"  ✓ {module} imported successfully")
            except ImportError as e:
                print(f"  ✗ {module} import failed: {e}")
    except Exception as e:
        print(f"Error testing imports: {e}")
    
    print("\nVerification Complete")

if __name__ == "__main__":
    main()
