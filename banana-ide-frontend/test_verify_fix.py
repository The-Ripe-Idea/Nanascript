import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# --- Config ---
DRIVER_PATH = './chromedriver'
URL = 'http://localhost:3000'
CODE_WITH_INPUT = """
🐵 🥥Enter a number: 🥥 🍌
🌴 x ➡️ 📥 🍌
🐵 🥥You entered: 🥥 🍌
🐵 x 🍌
"""
# This assumes your Java interpreter echoes the input!
EXPECTED_FINAL_TEXT = "Enter a number: \n42\nYou entered: \n42"

# --- Test ---
driver = webdriver.Chrome(DRIVER_PATH)
driver.get(URL)
print("Navigated to IDE.")

try:
    # 1. Enter code
    editor_textarea = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, ".ace_text-input"))
    )
    driver.execute_script(
        "window.ace.edit(document.querySelector('.ace_editor')).setValue(arguments[0]);", 
        CODE_WITH_INPUT
    )
    print("Code entered into editor.")

    # 2. Click Run
    run_button = driver.find_element(By.XPATH, "//button[contains(text(), 'Run')]")
    run_button.click()
    print("Run button clicked.")

    # 3. Wait for input
    input_field = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "input.console-input"))
    )
    print("Input field appeared.")
    
    console_output_pre = driver.find_element(By.CSS_SELECTOR, "pre.console-output")
    assert "Enter a number:" in console_output_pre.get_attribute('textContent')
    print("Initial prompt verified.")

    # 4. Send input
    input_field.send_keys("42")
    input_field.send_keys(Keys.ENTER)
    print("Input '42' sent.")

    # 5. Wait for the *final output* to appear
    # This is the key verification step.
    WebDriverWait(driver, 10).until(
        lambda d: EXPECTED_FINAL_TEXT in d.find_element(By.CSS_SELECTOR, "pre.console-output").get_attribute('textContent')
    )
    
    final_output = console_output_pre.get_attribute('textContent')
    print(f"Final Output: {final_output}")
    
    # This assertion will SUCCEED on the fixed code
    assert EXPECTED_FINAL_TEXT in final_output
    print("\n--- TEST PASSED ---")
    print("Output accumulated and displayed correctly after input.")

except Exception as e:
    print(f"\n--- TEST FAILED ---")
    print(f"Error: {e}")
finally:
    driver.quit()