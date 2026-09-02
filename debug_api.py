from app import app
import json

def test_api():
    with app.test_client() as client:
        response = client.get('/api/fixtures')
        if response.status_code == 200:
            data = response.get_json()
            print(json.dumps(data, indent=2))
        else:
            print(f"Error: {response.status_code}")
            print(response.get_data(as_text=True))

if __name__ == "__main__":
    test_api()
