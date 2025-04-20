import time
import logging
import json
import sys
from seleniumbase import Driver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s: %(message)s',
                   datefmt='%H:%M:%S')
logger = logging.getLogger()

for handler in logger.handlers[:]:
    logger.removeHandler(handler)

handler = logging.StreamHandler(sys.stdout)
logger.addHandler(handler)

def log_message(message, event=None, data=None):
    """Print messages that can be picked up by Electron"""
    logging.info(message)
    if event:
        json_output = json.dumps({
            "event": event,
            "message": message,
            "data": data or {}
        })
        print(json_output)
        sys.stdout.flush()

def setup_driver(headless=True):
    """Create a driver instance based on configuration"""
    if headless:
        driver = Driver(uc=True, headless2=True)
    else:
        driver = Driver(uc=True)
    
    driver.execute_cdp_cmd('Network.setUserAgentOverride', {
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    })
    
    driver.set_window_size(1920, 1080)
    
    return driver

def initial_login(driver, url, dlsu_id):
    """Handle the initial login"""
    try:
        driver.uc_open_with_reconnect(url, 4)
        log_message("Opened course offerings page.")
        
        log_message("Waiting for Cloudflare check to pass...")
        time.sleep(10)
        
        if "checking your browser" in driver.page_source.lower() or "cloudflare" in driver.page_source.lower():
            log_message("Cloudflare challenge detected. Attempting to solve...")
            
            checkbox_selectors = [
                "//input[@type='checkbox']",
                "//div[@class='cf-checkbox-container']",
                "//span[@id='checkbox']",
                "//iframe[contains(@src, 'captcha')]"
            ]
            
            for selector in checkbox_selectors:
                try:
                    element = WebDriverWait(driver, 5).until(
                        EC.presence_of_element_located((By.XPATH, selector))
                    )
                    
                    if selector.endswith("captcha')]"):
                        log_message("Found Cloudflare iframe. Switching to it...")
                        driver.switch_to.frame(element)
                        checkbox = WebDriverWait(driver, 5).until(
                            EC.element_to_be_clickable((By.XPATH, "//input[@type='checkbox'] | //div[@class='recaptcha-checkbox-border']"))
                        )
                        checkbox.click()
                        driver.switch_to.default_content()
                    else:
                        log_message(f"Found Cloudflare checkbox using selector: {selector}")
                        element.click()
                    
                    log_message("Clicked Cloudflare checkbox. Waiting for challenge to complete...")
                    time.sleep(10)
                    break
                except Exception as e:
                    continue
            
            if "checking your browser" in driver.page_source.lower() or "cloudflare" in driver.page_source.lower():
                log_message("Still on Cloudflare page. Trying mouse movements...")
                action = ActionChains(driver)
                action.move_by_offset(200, 200).perform()
                time.sleep(1)
                action.move_by_offset(-100, 50).perform()
                time.sleep(1)
                action.move_by_offset(50, -75).perform()
                time.sleep(8)
        else:
            log_message("No Cloudflare challenge detected, proceeding to login")
        
        time.sleep(5)
        
        try:
            id_field = WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.NAME, "p_id_no"))
            )
            log_message("Found login field. Entering DLSU ID...")
            id_field.send_keys(dlsu_id)
            
            button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.NAME, "p_button"))
            )
            button.click()
            
            log_message(f"Entered DLSU ID: {dlsu_id} and submitted the form.")
            time.sleep(3)
            return True
        except Exception as e:
            log_message(f"Could not find login fields: {e}")
            try:
                screenshot_path = "login_error_screenshot.png"
                driver.save_screenshot(screenshot_path)
                log_message(f"Saved error screenshot to {screenshot_path}")
            except:
                pass
                
            return False
    except Exception as e:
        log_message(f"Error during initial login: {e}")
        return False

def search_course(driver, course_code):
    """Search for a specific course code"""
    try:
        course_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.NAME, "p_course_code"))
        )
        course_input.clear()
        course_input.send_keys(course_code)
        driver.find_element(By.NAME, "p_button").click()
        log_message(f"Entered course code: {course_code} and submitted the form.")
        time.sleep(3)
        return True
    except Exception as e:
        log_message(f"Could not search for course {course_code}: {e}")
        return False

def check_class_availability(driver, course_code, target_class_code):
    """Check if the target class is open"""
    try:
        green_rows = driver.find_elements(By.XPATH, "//tr//td//font[@color='#006600']/b")
        if not green_rows:
            log_message(f"Class {target_class_code} is CLOSED.")
            return False

        for row in green_rows:
            if row.text.strip() == target_class_code:
                log_message(f"Class {target_class_code} is OPEN for enrollment!", event="class_available", data={
                    "course_code": course_code,
                    "class_code": target_class_code
                })
                return True

        log_message(f"Class {target_class_code} is CLOSED.")
        return False
    except Exception as e:
        log_message(f"Error checking class availability: {e}")
        return False

def refresh_and_check(driver, course_code, target_class_code):
    """Refresh the page and check for class availability"""
    try:
        driver.refresh()
        log_message("Page refreshed.")
        time.sleep(2)
        
        if "checking your browser" in driver.page_source.lower() or "cloudflare" in driver.page_source.lower():
            log_message("Cloudflare detected after refresh. Need to restart the process.")
            return "restart"
            
        return check_class_availability(driver, course_code, target_class_code)
    except Exception as e:
        log_message(f"Error during refresh: {e}")
        return "restart"

def check_course_class_pairs(driver, course_class_pairs):
    """Check multiple course-class pairs for availability"""
    available_classes = {}
    
    for course_code, class_codes in course_class_pairs.items():
        if not search_course(driver, course_code):
            log_message(f"Failed to search for course {course_code}. Skipping.")
            continue
        
        for class_code in class_codes:
            if check_class_availability(driver, course_code, class_code):
                if course_code not in available_classes:
                    available_classes[course_code] = []
                available_classes[course_code].append(class_code)
    
    return available_classes

def main():
    if len(sys.argv) != 2:
        log_message("Error: Configuration file path required.")
        return
    
    config_path = sys.argv[1]
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
    except Exception as e:
        log_message(f"Error loading configuration: {e}")
        return
    
    url = "https://enroll.dlsu.edu.ph/dlsu/view_course_offerings"
    dlsu_id = config.get('dlsu_id')
    refresh_interval = config.get('refresh_interval', 5)
    headless = config.get('headless', True)
    
    course_class_pairs = config.get('course_class_pairs', {})
    
    if not course_class_pairs:
        log_message("No course-class pairs specified. Exiting.")
        return
    
    log_message(f"Starting course check for multiple classes")
    log_message(f"Using DLSU ID: {dlsu_id}")
    log_message(f"Refresh interval: {refresh_interval} seconds")
    log_message(f"Headless mode: {'Enabled' if headless else 'Disabled'}")
    log_message(f"Checking {sum(len(classes) for classes in course_class_pairs.values())} classes across {len(course_class_pairs)} courses")
    
    for course, classes in course_class_pairs.items():
        log_message(f"  Course {course}: {', '.join(classes)}")
    
    count = 0
    available_classes = {}
    
    try:
        while True:
            driver = setup_driver(headless)
            log_message("Starting new session...")
            
            # initial login
            if not initial_login(driver, url, dlsu_id):
                log_message("Initial login failed. Restarting...")
                driver.quit()
                time.sleep(5)
                continue
            
            # initial check
            new_available = check_course_class_pairs(driver, course_class_pairs)
            
            # update available classes
            for course, classes in new_available.items():
                if course not in available_classes:
                    available_classes[course] = []
                for class_code in classes:
                    if class_code not in available_classes[course]:
                        available_classes[course].append(class_code)
            
            if available_classes:
                log_message("Found available classes! See summary below:")
                for course, classes in available_classes.items():
                    log_message(f"  {course}: {', '.join(classes)}")
            
            # start refresh loop
            refresh_count = 0
            while refresh_count < 10:
                refresh_count += 1
                count += 1
                log_message(f"Check #{count}: Refreshing page and checking classes...")
                time.sleep(refresh_interval)
                
                try:
                    # for each refresh, need to check each course again
                    for course_code in course_class_pairs.keys():
                        if not search_course(driver, course_code):
                            log_message(f"Failed to search for course {course_code} during refresh. Skipping.")
                            continue
                            
                        # check classes for this course
                        for class_code in course_class_pairs[course_code]:
                            result = check_class_availability(driver, course_code, class_code)
                            if result:
                                log_message(f"Class {course_code}-{class_code} is now open!", event="class_open", data={
                                    "course_code": course_code,
                                    "class_code": class_code
                                })
                                # update available classes
                                if course_code not in available_classes:
                                    available_classes[course_code] = []
                                if class_code not in available_classes[course_code]:
                                    available_classes[course_code].append(class_code)
                except Exception as e:
                    log_message(f"Error during refresh checks: {e}")
                    break
                
                # refresh the page for next loop
                result = refresh_and_check(driver, "", "")
                if result == "restart":
                    log_message("Need to restart the whole process.")
                    break
            
            driver.quit()
            log_message("Restarting the entire process...")
            time.sleep(2)
            
    except KeyboardInterrupt:
        log_message("Check process stopped.")
        if 'driver' in locals():
            driver.quit()
    except Exception as e:
        log_message(f"Unexpected error: {e}")
        if 'driver' in locals():
            driver.quit()

if __name__ == "__main__":
    main()