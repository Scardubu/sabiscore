import requests

URL = "http://127.0.0.1:8000/api/v1/insights"
PAYLOAD = {"matchup": "Manchester United vs Liverpool", "league": "EPL"}

response = requests.post(URL, json=PAYLOAD)
print("Status:", response.status_code)
try:
    print("JSON:", response.json())
except Exception:
    print("Text:", response.text)
