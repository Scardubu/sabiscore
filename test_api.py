import requests

try:
    response = requests.get('http://127.0.0.1:8000/api/v1/health')
    print("Health:", response.json())

    response = requests.get('http://127.0.0.1:8000/api/v1/matches/search?q=Manchester')
    data = response.json()
    print("Search results count:", len(data))
    if data:
        print("First result:", data[0])
except Exception as e:
    print(f"Error: {e}")
