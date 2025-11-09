import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# --- Config ---
DRIVER_PATH = './chromedriver' # Change this if chromedriver is elsewhere
URL = 'http://localhost:3000'
CODE_WITH_INPUT = """
🐵 🥥Enter a number: 🥥 🍌
🌴 x ➡️ 📥 🍌
🐵 🥥You entered: 🥥 🍌
🐵 x 🍌
"""

# --- Test ---
driver = webdriver.Chrome(DRIVER_PATH)
driver.get(URL)
print("Navigated to IDE.")

try:
    # 1. Find editor, enter code
    # Note: CodeEditor.jsx uses an Ace editor, which creates a textarea
    editor_textarea = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, ".ace_text-input"))
    )
    # HACK: Ace editor is complex. We'll use JS to set its value.
    driver.execute_script(
        "window.ace.edit(document.querySelector('.ace_editor')).setValue(arguments[0]);", 
        CODE_WITH_INPUT
    )
    print("Code entered into editor.")

    # 2. Find and click Run button
    run_button = driver.find_element(By.XPATH, "//button[contains(text(), 'Run')]")
    run_button.click()
    print("Run button clicked.")

    # 3. Wait for the input field to appear
    input_field = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "input.console-input"))
    )
    print("Input field appeared.")

    # 4. Check initial output
    console_output_pre = driver.find_element(By.CSS_SELECTOR, "pre.console-output")
    initial_output = console_output_pre.get_attribute('textContent')
    print(f"Initial Output: {initial_output}")
    assert "Enter a number:" in initial_output

    # 5. Send input
    input_field.send_keys("42")
    input_field.send_keys(Keys.ENTER)
    print("Input '42' sent.")

    # 6. Wait for polling to (mis)behave
    print("Waiting 2 seconds for polling...")
    time.sleep(2) 

    # 7. Check the (now broken) output
    final_output = console_output_pre.get_attribute('textContent')
    print(f"Final Output: {final_output}")

    # This assertion will FAIL on the buggy code, as the output is frozen
    assert "You entered: 42" in final_output
    print("TEST PASSED: Output updated successfully.")

except Exception as e:
    print(f"\n--- TEST FAILED ---")
    print(f"Output did not update after input.")
    print(f"Final console content: '{final_output}'")
    print(f"Error: {e}")
finally:
    driver.quit()