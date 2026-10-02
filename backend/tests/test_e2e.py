from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parents[2]


class EndToEndTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        cls.base_url = f"http://127.0.0.1:{port}"
        cls.env = {**os.environ, "RIFT_DATA_DIR": cls.temp.name, "RIOT_API_KEY": ""}
        cls.server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", str(port)],
            cwd=ROOT, env=cls.env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        cls.addClassCleanup(cls.stop_server)
        for _ in range(100):
            try:
                with urllib.request.urlopen(cls.base_url + "/openapi.json", timeout=1):
                    return
            except urllib.error.URLError:
                if cls.server.poll() is not None:
                    raise RuntimeError("The API exited before becoming available")
                time.sleep(0.1)
        raise RuntimeError("The API did not become available")

    @classmethod
    def stop_server(cls):
        cls.server.terminate()
        try:
            cls.server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.server.kill()
            cls.server.wait()
        cls.temp.cleanup()

    def request(self, path, payload=None):
        data = json.dumps(payload).encode() if payload is not None else None
        request = urllib.request.Request(
            self.base_url + path, data=data,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read())

    def create_journey(self, player):
        payload = json.loads((ROOT / "examples/demo-matches.json").read_text(encoding="utf-8"))
        job = self.request("/api/journeys/upload", {
            "playerName": player, "useLocalLlm": False, "payload": payload,
        })
        for _ in range(50):
            status = self.request(f"/api/jobs/{job['jobId']}")
            if status["status"] in ("completed", "error"):
                break
            time.sleep(0.1)
        self.assertEqual(status["status"], "completed", status)
        return job["jobId"], self.request(f"/api/journeys/{job['jobId']}")

    def test_upload_to_journey_export(self):
        job_id, journey = self.create_journey("Demo#ONE")
        self.assertEqual(journey["metadata"]["totalGames"], 8)
        self.assertEqual(len(journey["finale"]["journey_map"]), 4)
        self.assertTrue(all(quarter["lore"] for quarter in journey["quarters"].values()))
        self.assertEqual(journey["narrative"]["provider"], "deterministic-fallback")
        exported = self.request(f"/api/journeys/{job_id}/export")
        self.assertEqual(exported, journey)

    def test_two_player_expedition_to_skill_download(self):
        _, first = self.create_journey("Demo#ONE")
        _, second = self.create_journey("Demo#TWO")
        job = self.request("/api/duo-journeys", {
            "player1": first, "player2": second, "useLocalLlm": False,
        })
        for _ in range(50):
            status = self.request(f"/api/jobs/{job['jobId']}")
            if status["status"] in ("completed", "error"):
                break
            time.sleep(0.1)
        self.assertEqual(status["status"], "completed", status)
        journey = self.request(f"/api/duo-journeys/{job['jobId']}")
        self.assertEqual(len(journey["agents"]), 2)
        self.assertEqual(len(journey["journey_map"]), 4)
        self.assertEqual(journey["negotiation"]["turns"][-1]["intent"], "agreement")
        url = self.base_url + f"/api/duo-journeys/{job['jobId']}/agents/agent-a/skill"
        with urllib.request.urlopen(url, timeout=5) as response:
            self.assertEqual(response.headers.get_content_type(), "text/markdown")
            self.assertTrue(response.read().decode().startswith("---\nname:"))

    def test_command_line_journey_generation(self):
        output = Path(self.temp.name) / "cli-journey.json"
        subprocess.run([
            sys.executable, "create_journey.py", "examples", "--player-name", "Demo",
            "--no-llm", "--output", str(output),
        ], cwd=ROOT, env=self.env, check=True, capture_output=True, timeout=20)
        journey = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(journey["type"], "complete-journey")
        self.assertEqual(journey["metadata"]["totalGames"], 8)
        self.assertEqual(len(journey["quarters"]), 4)


if __name__ == "__main__":
    unittest.main()
