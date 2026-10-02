from __future__ import annotations

import unittest
import json
import tempfile
from pathlib import Path

from backend.config import Settings
from backend.service import JourneyService
from backend.storage import LocalStore

from fastapi.testclient import TestClient

from backend.main import app
from backend.tests.test_analytics import game


class ApiTests(unittest.TestCase):
    def test_folder_build_accepts_the_browser_upload_format(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / "matches.json").write_text(json.dumps({
                "matches": [game(i).to_dict() for i in range(8)]
            }), encoding="utf-8")
            config = Settings(data_dir=folder / "store")
            service = JourneyService(config, LocalStore(config))
            result = service.build_from_folder(folder, "Demo", "explorer", 2025, False)
        self.assertEqual(result["metadata"]["totalGames"], 8)
        self.assertEqual(result["narrative"]["provider"], "deterministic-fallback")

    @staticmethod
    def _create_journey(client: TestClient, player_name: str, improving: bool) -> dict:
        response = client.post("/api/journeys/upload", json={
            "playerName": player_name,
            "archetype": "explorer",
            "year": 2025,
            "useLocalLlm": False,
            "payload": {"matches": [game(index, improving=improving).to_dict() for index in range(8)]},
        })
        job_id = response.json()["jobId"]
        return client.get(f"/api/journeys/{job_id}").json()

    def test_uploaded_matches_create_complete_local_journey(self) -> None:
        client = TestClient(app)
        response = client.post("/api/journeys/upload", json={
            "playerName": "LocalTester#TEST",
            "archetype": "explorer",
            "year": 2025,
            "useLocalLlm": False,
            "payload": {"matches": [game(index, improving=True).to_dict() for index in range(8)]},
        })
        self.assertEqual(response.status_code, 202)
        job_id = response.json()["jobId"]
        status = client.get(f"/api/jobs/{job_id}").json()
        self.assertEqual(status["status"], "completed")
        journey = client.get(f"/api/journeys/{job_id}").json()
        self.assertEqual(journey["type"], "complete-journey")
        self.assertEqual(journey["metadata"]["source"], "local")
        self.assertEqual(len(journey["finale"]["journey_map"]), 4)
        self.assertEqual(journey["narrative"]["provider"], "deterministic-fallback")

    def test_duo_journey_builds_two_skills_negotiation_and_route(self) -> None:
        client = TestClient(app)
        first = self._create_journey(client, "Pathfinder#ONE", improving=True)
        second = self._create_journey(client, "Warden#TWO", improving=False)
        for quarter in second["quarters"].values():
            quarter["values"]["Security"] = 96
            quarter["values"]["Tradition"] = 92
            quarter["values"]["Stimulation"] = 12

        response = client.post("/api/duo-journeys", json={"player1": first, "player2": second, "useLocalLlm": False})
        self.assertEqual(response.status_code, 202)
        job_id = response.json()["jobId"]
        status = client.get(f"/api/jobs/{job_id}").json()
        self.assertEqual(status["status"], "completed")

        duo = client.get(f"/api/duo-journeys/{job_id}").json()
        self.assertEqual(duo["type"], "duo-journey")
        self.assertEqual(len(duo["agents"]), 2)
        self.assertNotEqual(duo["agents"][0]["skill_name"], duo["agents"][1]["skill_name"])
        self.assertIn("# Negotiation policy", duo["agents"][0]["skill_markdown"])
        self.assertIn("Do not invent ranks", duo["agents"][1]["skill_markdown"])
        self.assertEqual([turn["speaker_id"] for turn in duo["negotiation"]["turns"]], ["agent-a", "agent-b", "agent-a", "agent-b", "agent-a"])
        self.assertEqual(duo["negotiation"]["turns"][-1]["intent"], "agreement")
        self.assertEqual(len(duo["journey_map"]), 4)
        self.assertEqual(duo["narrative"]["provider"], "deterministic-fallback")

        skill = client.get(f"/api/duo-journeys/{job_id}/agents/agent-a/skill")
        self.assertEqual(skill.status_code, 200)
        self.assertEqual(skill.headers["content-type"].split(";")[0], "text/markdown")
        self.assertTrue(skill.text.startswith("---\nname:"))


if __name__ == "__main__":
    unittest.main()
