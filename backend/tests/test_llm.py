from __future__ import annotations

import unittest
from unittest.mock import patch

from backend.analytics import build_season_analysis
from backend.config import Settings
from backend.llm import LocalLLMError, OllamaClient
from backend.narrative import NarrativeEngine
from backend.tests.test_analytics import game


class NarrativeFallbackTests(unittest.TestCase):
    def test_malformed_json_is_reported_as_model_error(self) -> None:
        client = OllamaClient(Settings())
        for raw in ('not JSON', 'prefix {broken} suffix', '[1, 2]'):
            with self.subTest(raw=raw), patch.object(client, '_request', return_value={'response': raw}):
                with self.assertRaises(LocalLLMError):
                    client.generate_json('A chapter')

    def test_malformed_model_response_preserves_complete_journey(self) -> None:
        client = OllamaClient(Settings())
        analysis = build_season_analysis([game(i) for i in range(8)])
        with patch.object(client, '_request', return_value={'response': 'prefix {broken} suffix'}):
            result = NarrativeEngine(client).enrich(analysis, 'Tester', 'explorer', True)
        self.assertEqual(result['narrative']['provider'], 'deterministic-fallback')
        self.assertEqual(result['narrative']['generated_sections'], 0)
        self.assertTrue(all(period['lore'] for period in result['periods']))
        self.assertTrue(result['finale']['lore'])
