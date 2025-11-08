#!/usr/bin/env python3
"""
Test script to verify Riot API key is valid
"""
import requests
import json
import sys

# Test with the key from Secrets Manager
API_KEY = "RGAPI-82650f00-053c-4a87-9687-9fb719afc6fd"

def test_riot_api_key():
    """Test if the API key works"""
    
    print(f"Testing Riot API key: {API_KEY[:20]}...")
    print()
    
    # Try to get PUUID for a known player
    url = "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/bst/0123"
    headers = {"X-Riot-Token": API_KEY}
    
    print(f"URL: {url}")
    print(f"Headers: X-Riot-Token: {API_KEY[:20]}...")
    print()
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response:")
        print(json.dumps(response.json(), indent=2))
        print()
        
        if response.status_code == 200:
            print("✅ API KEY IS VALID!")
            return True
        elif response.status_code == 401:
            print("❌ API KEY IS INVALID OR EXPIRED")
            print("   Your key has expired (free keys last 24 hours)")
            print("   Get a new one from: https://developer.riotgames.com/")
            return False
        elif response.status_code == 404:
            print("⚠️  API KEY IS VALID but player not found")
            print("   (This is OK - means the key works)")
            return True
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = test_riot_api_key()
    sys.exit(0 if success else 1)
